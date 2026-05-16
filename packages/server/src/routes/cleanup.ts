import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";
import { getRunDir, GITHUB_TOKEN, GITHUB_REPO } from "../config.js";
import { requireToken } from "../guards/auth-guard.js";
import fsp from "fs/promises";

const MAX_RUNS_PER_PR_PHASE = parseInt(process.env.MAX_RUNS_PER_PR_PHASE || "2", 10);
const MAX_RUNS_PER_NULL_PR_GROUP = parseInt(process.env.MAX_RUNS_PER_NULL_PR_GROUP || "1", 10);
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "7", 10);
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || `${60 * 60 * 1000}`, 10);
const PR_CHECK_TTL_MS = parseInt(process.env.PR_CHECK_TTL_MS || `${6 * 60 * 60 * 1000}`, 10);

// Per-PR check cache: pr_number -> { state, checkedAt }
const prStateCache = new Map<number, { state: string; checkedAt: number }>();

async function deleteRunDir(runId: string): Promise<void> {
  try {
    await fsp.rm(getRunDir(runId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function markDeleted(runIds: string[]): void {
  if (runIds.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE runs SET reports_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
  );
  const tx = db.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(id);
  });
  tx(runIds);
}

/**
 * Per-PR retention: keep latest N runs per (pr_number, phase).
 * DB rows are retained — only the run directory is removed and reports_deleted is set.
 * This preserves aggregate stats and per-test history for trends.
 */
export async function pruneOldRuns(prNumber: number): Promise<number> {
  if (!prNumber) return 0;
  const db = getDb();
  const phases = db
    .prepare(
      `SELECT DISTINCT phase FROM runs WHERE pr_number = ? AND reports_deleted = 0`
    )
    .all(prNumber) as { phase: string }[];

  const idsToDelete: string[] = [];
  for (const { phase } of phases) {
    const excessRuns = db
      .prepare(
        `SELECT id FROM runs
         WHERE pr_number = ? AND phase = ? AND reports_deleted = 0
         ORDER BY created_at DESC
         LIMIT -1 OFFSET ?`
      )
      .all(prNumber, phase, MAX_RUNS_PER_PR_PHASE) as { id: string }[];
    for (const r of excessRuns) idsToDelete.push(r.id);
  }

  for (const id of idsToDelete) await deleteRunDir(id);
  markDeleted(idsToDelete);

  if (idsToDelete.length > 0) {
    console.log(
      `[retention] PR #${prNumber}: pruned ${idsToDelete.length} old runs, keeping latest ${MAX_RUNS_PER_PR_PHASE} per phase`
    );
  }
  return idsToDelete.length;
}

async function pruneAllPRs(): Promise<number> {
  const db = getDb();
  const prs = db
    .prepare(
      `SELECT DISTINCT pr_number FROM runs
       WHERE pr_number IS NOT NULL AND reports_deleted = 0`
    )
    .all() as { pr_number: number }[];
  let total = 0;
  for (const { pr_number } of prs) total += await pruneOldRuns(pr_number);
  return total;
}

/**
 * Prune runs with NULL pr_number (e.g. develop / main / manual uploads).
 * Keeps the latest N per (branch, phase). Without this, these accumulate forever.
 */
export async function pruneNullPrRuns(): Promise<number> {
  const db = getDb();
  const groups = db
    .prepare(
      `SELECT DISTINCT branch, phase FROM runs
       WHERE pr_number IS NULL AND reports_deleted = 0`
    )
    .all() as { branch: string; phase: string }[];

  const idsToDelete: string[] = [];
  for (const { branch, phase } of groups) {
    const excess = db
      .prepare(
        `SELECT id FROM runs
         WHERE pr_number IS NULL AND branch = ? AND phase = ? AND reports_deleted = 0
         ORDER BY created_at DESC
         LIMIT -1 OFFSET ?`
      )
      .all(branch, phase, MAX_RUNS_PER_NULL_PR_GROUP) as { id: string }[];
    for (const r of excess) idsToDelete.push(r.id);
  }

  for (const id of idsToDelete) await deleteRunDir(id);
  markDeleted(idsToDelete);
  if (idsToDelete.length > 0) {
    console.log(
      `[retention] null-PR: pruned ${idsToDelete.length} old runs, keeping latest ${MAX_RUNS_PER_NULL_PR_GROUP} per (branch, phase)`
    );
  }
  return idsToDelete.length;
}

/**
 * Hard max-age cap: any run with reports older than MAX_AGE_DAYS is pruned.
 * Acts as a safety net when GitHub PR-state lookup is unavailable.
 * DB rows are retained for historic stats.
 */
export async function pruneByMaxAge(): Promise<number> {
  if (MAX_AGE_DAYS <= 0) return 0;
  const db = getDb();
  const old = db
    .prepare(
      `SELECT id FROM runs
       WHERE reports_deleted = 0
         AND created_at < datetime('now', ?)`
    )
    .all(`-${MAX_AGE_DAYS} days`) as { id: string }[];

  for (const r of old) await deleteRunDir(r.id);
  markDeleted(old.map((r) => r.id));
  if (old.length > 0) {
    console.log(`[retention] max-age: pruned ${old.length} runs older than ${MAX_AGE_DAYS} days`);
  }
  return old.length;
}

async function fetchPrState(prNumber: number): Promise<string | null> {
  const cached = prStateCache.get(prNumber);
  if (cached && Date.now() - cached.checkedAt < PR_CHECK_TTL_MS) {
    return cached.state;
  }
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/pulls/${prNumber}`,
      { headers }
    );

    if (response.status === 403 || response.status === 429) {
      // Rate-limited. Skip; max-age sweep will catch stale runs.
      return null;
    }
    if (!response.ok) return null;
    const pr = (await response.json()) as { state?: string };
    if (pr.state) {
      prStateCache.set(prNumber, { state: pr.state, checkedAt: Date.now() });
      return pr.state;
    }
    return null;
  } catch {
    return null;
  }
}

export async function runCleanup() {
  const db = getDb();
  const prs = db
    .prepare(
      `SELECT DISTINCT pr_number FROM runs
       WHERE pr_number IS NOT NULL AND reports_deleted = 0`
    )
    .all() as { pr_number: number }[];

  let cleaned = 0;
  let errors = 0;
  let prsChecked = 0;

  for (const { pr_number } of prs) {
    try {
      const state = await fetchPrState(pr_number);
      if (state == null) continue; // unreachable / rate-limited
      prsChecked++;
      if (state !== "closed") continue;

      const runs = db
        .prepare(
          "SELECT id FROM runs WHERE pr_number = ? AND reports_deleted = 0"
        )
        .all(pr_number) as { id: string }[];

      for (const run of runs) await deleteRunDir(run.id);
      markDeleted(runs.map((r) => r.id));
      cleaned += runs.length;
    } catch (e) {
      console.error(`[cleanup] PR #${pr_number}:`, e);
      errors++;
    }
  }

  const pruned = await pruneAllPRs();
  const nullPruned = await pruneNullPrRuns();
  const agedOut = await pruneByMaxAge();

  return {
    cleaned,
    pruned,
    nullPruned,
    agedOut,
    errors,
    prsChecked,
    prsTotal: prs.length,
  };
}

export function startCleanupScheduler() {
  setTimeout(async () => {
    try {
      const r = await runCleanup();
      console.log(
        `[cleanup] Initial: ${r.cleaned} closed, ${r.pruned} per-PR, ${r.nullPruned} null-PR, ${r.agedOut} aged-out, ${r.errors} errs, ${r.prsChecked}/${r.prsTotal} PRs checked`
      );
    } catch (e) {
      console.error("[cleanup] Initial cleanup failed:", e);
    }
  }, 2 * 60 * 1000);

  setInterval(async () => {
    try {
      const r = await runCleanup();
      console.log(
        `[cleanup] Scheduled: ${r.cleaned} closed, ${r.pruned} per-PR, ${r.nullPruned} null-PR, ${r.agedOut} aged-out, ${r.errors} errs, ${r.prsChecked}/${r.prsTotal} PRs checked`
      );
    } catch (e) {
      console.error("[cleanup] Scheduled cleanup failed:", e);
    }
  }, CLEANUP_INTERVAL_MS);
}

export default async function cleanupRoutes(fastify: FastifyInstance) {
  fastify.post("/api/cleanup", { preHandler: requireToken }, async () => {
    return runCleanup();
  });
}
