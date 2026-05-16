/**
 * Read-only retention simulator.
 *
 *   DB_PATH=/path/to/reports.db.snapshot \
 *   REPORTS_DIR=/path/to/data/reports \
 *   npx tsx scripts/retention-dryrun.ts
 *
 * Loads a snapshot DB, simulates the new retention rules in-memory, prints
 * how many runs and how many bytes would be reclaimed per rule.
 * No mutations: safe to run against prod DB copies.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH || "./data/reports.db";
const REPORTS_DIR = process.env.REPORTS_DIR || "./data/reports";
const MAX_RUNS_PER_PR_PHASE = parseInt(process.env.MAX_RUNS_PER_PR_PHASE || "2", 10);
const MAX_RUNS_PER_NULL_PR_GROUP = parseInt(process.env.MAX_RUNS_PER_NULL_PR_GROUP || "1", 10);
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "7", 10);

interface Run {
  id: string;
  branch: string;
  phase: string;
  pr_number: number | null;
  created_at: string;
  reports_deleted: number;
}

function dirSize(p: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      const sub = path.join(p, e.name);
      if (e.isDirectory()) total += dirSize(sub);
      else if (e.isFile()) total += fs.statSync(sub).size;
    }
  } catch {
    /* missing dir = 0 */
  }
  return total;
}

function fmt(n: number): string {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(2)} ${u[i]}`;
}

function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const all = db
    .prepare(
      `SELECT id, branch, phase, pr_number, created_at, reports_deleted FROM runs WHERE reports_deleted = 0`
    )
    .all() as Run[];

  console.log(`Loaded ${all.length} active runs from ${DB_PATH}`);

  const toDelete = new Set<string>();
  const reasons = new Map<string, string>();

  // Rule 1: max age
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const r of all) {
    if (new Date(r.created_at + "Z").getTime() < cutoff) {
      toDelete.add(r.id);
      reasons.set(r.id, `>${MAX_AGE_DAYS}d`);
    }
  }

  // Rule 2: per (pr, phase) keep latest N
  const byPrPhase = new Map<string, Run[]>();
  for (const r of all) {
    if (r.pr_number == null) continue;
    const key = `${r.pr_number}|${r.phase}`;
    (byPrPhase.get(key) ?? byPrPhase.set(key, []).get(key)!).push(r);
  }
  for (const [, runs] of byPrPhase) {
    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const r of runs.slice(MAX_RUNS_PER_PR_PHASE)) {
      if (!toDelete.has(r.id)) {
        toDelete.add(r.id);
        reasons.set(r.id, `pr-phase>${MAX_RUNS_PER_PR_PHASE}`);
      }
    }
  }

  // Rule 3: null PR per (branch, phase) keep latest N
  const byBranchPhase = new Map<string, Run[]>();
  for (const r of all) {
    if (r.pr_number != null) continue;
    const key = `${r.branch}|${r.phase}`;
    (byBranchPhase.get(key) ?? byBranchPhase.set(key, []).get(key)!).push(r);
  }
  for (const [, runs] of byBranchPhase) {
    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const r of runs.slice(MAX_RUNS_PER_NULL_PR_GROUP)) {
      if (!toDelete.has(r.id)) {
        toDelete.add(r.id);
        reasons.set(r.id, `null-pr>${MAX_RUNS_PER_NULL_PR_GROUP}`);
      }
    }
  }

  // Size up the deletion plan
  const byReason = new Map<string, { count: number; bytes: number }>();
  let totalBytes = 0;
  for (const id of toDelete) {
    const sz = dirSize(path.join(REPORTS_DIR, id));
    totalBytes += sz;
    const r = reasons.get(id)!;
    const e = byReason.get(r) ?? { count: 0, bytes: 0 };
    e.count++;
    e.bytes += sz;
    byReason.set(r, e);
  }

  console.log("\n--- Dry-run plan ---");
  for (const [r, e] of [...byReason.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${r.padEnd(20)} ${String(e.count).padStart(4)} runs   ${fmt(e.bytes)}`);
  }
  console.log(`  ---`);
  console.log(`  TOTAL                ${String(toDelete.size).padStart(4)} runs   ${fmt(totalBytes)}`);

  // What remains
  const remaining = all.length - toDelete.size;
  let remainingBytes = 0;
  for (const r of all) {
    if (!toDelete.has(r.id)) remainingBytes += dirSize(path.join(REPORTS_DIR, r.id));
  }
  console.log(`\nAfter prune: ${remaining} runs, ${fmt(remainingBytes)} on disk`);

  // Sanity: never delete DB rows; stats survive.
  console.log(`\nDB rows preserved: trends will read aggregate stats from runs/test_cases for all ${all.length} runs.`);
}

main();
