import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";
import { getRunDir } from "../config.js";
import { requireAuth, requireToken } from "../guards/auth-guard.js";
import type { Run, TestCase } from "@artemis-e2e/shared";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const RUN_COLUMNS = `
  id, github_run_id, branch, commit_sha, pr_number, triggered_by, created_at, status,
  total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests, duration_ms,
  coverage_pct, phase, has_monocart, has_coverage, has_videos, upload_size_bytes,
  reports_deleted, deleted_at
`.trim();

const TEST_CASE_COLUMNS = `
  id, run_id, suite_name, test_name, classname, status, duration_ms,
  failure_message, failure_details, has_video, video_path
`.trim();

interface RawRun {
  id: string;
  github_run_id: string;
  branch: string;
  commit_sha: string;
  pr_number: number | null;
  triggered_by: string | null;
  created_at: string;
  status: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  flaky_tests: number;
  duration_ms: number;
  coverage_pct: number | null;
  phase: string;
  has_monocart: number;
  has_coverage: number;
  has_videos: number;
  upload_size_bytes: number;
  reports_deleted: number;
  deleted_at: string | null;
}

interface RawTestCase {
  id: number;
  run_id: string;
  suite_name: string;
  test_name: string;
  classname: string | null;
  status: string;
  duration_ms: number;
  failure_message: string | null;
  failure_details: string | null;
  has_video: number;
  video_path: string | null;
}

function mapRun(raw: RawRun): Run {
  return {
    ...raw,
    status: raw.status as Run["status"],
    has_monocart: Boolean(raw.has_monocart),
    has_coverage: Boolean(raw.has_coverage),
    has_videos: Boolean(raw.has_videos),
    reports_deleted: Boolean(raw.reports_deleted),
  };
}

function mapTestCase(raw: RawTestCase): TestCase {
  return {
    ...raw,
    status: raw.status as TestCase["status"],
    has_video: Boolean(raw.has_video),
  };
}

interface RunsQuery {
  page?: string;
  limit?: string;
  branch?: string;
  status?: string;
  pr_number?: string;
  phase?: string;
  q?: string;
}

interface RunParams {
  id: string;
}

export default async function runsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: RunsQuery }>(
    "/api/runs",
    { preHandler: requireAuth },
    async (request) => {
      const { page: pageStr, limit: limitStr, branch, status, pr_number, phase, q } = request.query;
      const page = Math.max(parseInt(pageStr || "1") || 1, 1);
      const limit = Math.min(Math.max(parseInt(limitStr || "20") || 20, 1), 100);

      const db = getDb();
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (branch) {
        conditions.push("branch = ?");
        params.push(branch);
      }
      if (status) {
        conditions.push("status = ?");
        params.push(status);
      }
      if (pr_number) {
        const prNum = parseInt(pr_number, 10);
        if (!Number.isNaN(prNum)) {
          conditions.push("pr_number = ?");
          params.push(prNum);
        }
      }
      if (phase) {
        conditions.push("phase = ?");
        params.push(phase);
      }
      if (q) {
        const escaped = q.replace(/[%_]/g, c => `\\${c}`);
        const like = `%${escaped}%`;
        conditions.push("(branch LIKE ? ESCAPE '\\' OR commit_sha LIKE ? ESCAPE '\\' OR CAST(pr_number AS TEXT) LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')");
        params.push(like, like, like, like);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const offset = (page - 1) * limit;

      const total = db
        .prepare(`SELECT COUNT(*) as count FROM runs ${where}`)
        .get(...params) as { count: number };

      const runs = db
        .prepare(`SELECT ${RUN_COLUMNS} FROM runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset) as RawRun[];

      return {
        items: runs.map(mapRun),
        pagination: {
          page,
          limit,
          total: total.count,
          totalPages: Math.ceil(total.count / limit),
        },
      };
    }
  );

  fastify.get<{ Params: RunParams }>(
    "/api/runs/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const rawRun = db.prepare(`SELECT ${RUN_COLUMNS} FROM runs WHERE id = ?`).get(id) as RawRun | undefined;
      if (!rawRun) {
        return reply.code(404).send({ error: "Run not found" });
      }

      const rawTestCases = db
        .prepare(
          `SELECT ${TEST_CASE_COLUMNS} FROM test_cases WHERE run_id = ?` +
          ` ORDER BY CASE status WHEN 'failed' THEN 0 WHEN 'error' THEN 1 WHEN 'skipped' THEN 2 ELSE 3 END, suite_name, test_name`
        )
        .all(id) as RawTestCase[];

      return { run: mapRun(rawRun), testCases: rawTestCases.map(mapTestCase) };
    }
  );

  fastify.delete<{ Params: RunParams }>(
    "/api/runs/:id",
    { preHandler: requireToken },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const run = db.prepare("SELECT id, reports_deleted FROM runs WHERE id = ?").get(id) as { id: string; reports_deleted: number } | undefined;
      if (!run) {
        return reply.code(404).send({ error: "Run not found" });
      }

      // Delete report files from disk
      const runDir = getRunDir(id);
      try {
        await fsp.rm(runDir, { recursive: true, force: true });
      } catch {
        // Directory might not exist
      }

      // Mark as deleted in DB (keep stats)
      db.prepare(
        "UPDATE runs SET reports_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(id);

      return {
        deleted: true,
        runId: id,
        message: "Report files deleted. Statistics preserved.",
      };
    }
  );

  // Monocart reports listing for a run
  fastify.get<{ Params: RunParams }>(
    "/api/runs/:id/monocart-reports",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const run = db
        .prepare("SELECT has_monocart, reports_deleted FROM runs WHERE id = ?")
        .get(id) as { has_monocart: number; reports_deleted: number } | undefined;
      if (!run || !run.has_monocart || run.reports_deleted) {
        return reply.code(404).send({ error: "No monocart reports available" });
      }

      const runDir = getRunDir(id);
      const reports: { name: string; label: string; path: string }[] = [];

      try {
        const entries = fs.readdirSync(runDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith("monocart")) {
            const indexPath = path.join(runDir, entry.name, "index.html");
            if (fs.existsSync(indexPath)) {
              const suffix = entry.name.replace("monocart-", "").replace("monocart", "");
              const label = suffix
                ? suffix.charAt(0).toUpperCase() + suffix.slice(1)
                : "Report";
              reports.push({
                name: entry.name,
                label,
                path: `/reports/${id}/${entry.name}/index.html`,
              });
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }

      reports.sort((a, b) => a.name.localeCompare(b.name));
      return { reports };
    }
  );
}
