import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";
import { getRunDir, GITHUB_TOKEN } from "../config.js";
import { requireToken } from "../guards/auth-guard.js";
import fsp from "fs/promises";

const MAX_RUNS_PER_PR = parseInt(process.env.MAX_RUNS_PER_PR || "2", 10);

export async function pruneOldRuns(prNumber: number): Promise<number> {
  if (!prNumber) return 0;
  const db = getDb();
  const excessRuns = db.prepare(
    `SELECT id FROM runs
     WHERE pr_number = ? AND reports_deleted = 0
     ORDER BY created_at DESC
     LIMIT -1 OFFSET ?`
  ).all(prNumber, MAX_RUNS_PER_PR) as { id: string }[];

  let pruned = 0;
  for (const run of excessRuns) {
    try {
      await fsp.rm(getRunDir(run.id), { recursive: true, force: true });
    } catch {}
    db.prepare(
      "UPDATE runs SET reports_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(run.id);
    pruned++;
  }
  if (pruned > 0) {
    console.log(`[retention] PR #${prNumber}: pruned ${pruned} old runs, keeping latest ${MAX_RUNS_PER_PR}`);
  }
  return pruned;
}

async function pruneAllPRs(): Promise<number> {
  const db = getDb();
  const prs = db.prepare(
    "SELECT DISTINCT pr_number FROM runs WHERE pr_number IS NOT NULL AND reports_deleted = 0"
  ).all() as { pr_number: number }[];
  let totalPruned = 0;
  for (const { pr_number } of prs) {
    totalPruned += await pruneOldRuns(pr_number);
  }
  return totalPruned;
}

export async function runCleanup() {
  const db = getDb();

  const prs = db
    .prepare(
      "SELECT DISTINCT pr_number FROM runs WHERE pr_number IS NOT NULL AND reports_deleted = 0"
    )
    .all() as { pr_number: number }[];

  let cleaned = 0;
  let errors = 0;

  for (const { pr_number } of prs) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/ls1intum/Artemis/pulls/${pr_number}`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      if (!response.ok) continue;

      const pr = await response.json();

      if (pr.state === "closed") {
        const runs = db
          .prepare(
            "SELECT id FROM runs WHERE pr_number = ? AND reports_deleted = 0"
          )
          .all(pr_number) as { id: string }[];

        for (const run of runs) {
          try {
            const runDir = getRunDir(run.id);
            await fsp.rm(runDir, { recursive: true, force: true });
          } catch {
            // Directory might not exist
          }
        }

        db.prepare(
          "UPDATE runs SET reports_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE pr_number = ?"
        ).run(pr_number);

        cleaned += runs.length;
      }
    } catch (error) {
      console.error(`Error checking PR #${pr_number}:`, error);
      errors++;
    }
  }

  const pruned = await pruneAllPRs();

  return {
    cleaned,
    pruned,
    errors,
    prsChecked: prs.length,
  };
}

export function startCleanupScheduler() {
  setTimeout(async () => {
    try {
      const result = await runCleanup();
      console.log(`[cleanup] Initial: ${result.cleaned} closed-PR cleaned, ${result.pruned} retention-pruned, ${result.errors} errors, ${result.prsChecked} PRs checked`);
    } catch (e) {
      console.error("[cleanup] Initial cleanup failed:", e);
    }
  }, 2 * 60 * 1_000);
  setInterval(async () => {
    try {
      const result = await runCleanup();
      console.log(`[cleanup] Scheduled: ${result.cleaned} closed-PR cleaned, ${result.pruned} retention-pruned, ${result.errors} errors, ${result.prsChecked} PRs checked`);
    } catch (e) {
      console.error("[cleanup] Scheduled cleanup failed:", e);
    }
  }, 24 * 60 * 60 * 1_000);
}

export default async function cleanupRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/cleanup",
    { preHandler: requireToken },
    async () => {
      if (!GITHUB_TOKEN) {
        return {
          message: "GITHUB_TOKEN not configured — cleanup disabled. Add it to enable auto-cleanup.",
        };
      }
      return runCleanup();
    }
  );
}
