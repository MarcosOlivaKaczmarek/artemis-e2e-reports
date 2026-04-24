import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db.js";
import { getRunDir } from "../config.js";
import { requireAuth, requireToken } from "../guards/auth-guard.js";
import fsp from "fs/promises";
import fs from "fs";
import path from "path";

export default async function runsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/runs",
    { preHandler: requireAuth },
    async (request: FastifyRequest) => {
      const { page: pageStr, limit: limitStr, branch, status, pr_number } =
        request.query as Record<string, string>;
      const page = parseInt(pageStr || "1");
      const limit = Math.min(parseInt(limitStr || "20"), 100);
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
        conditions.push("pr_number = ?");
        params.push(parseInt(pr_number));
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const offset = (page - 1) * limit;

      const total = db
        .prepare(`SELECT COUNT(*) as count FROM runs ${where}`)
        .get(...params) as { count: number };
      const runs = db
        .prepare(`SELECT * FROM runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);

      return {
        runs,
        pagination: {
          page,
          limit,
          total: total.count,
          totalPages: Math.ceil(total.count / limit),
        },
      };
    }
  );

  fastify.get(
    "/api/runs/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const db = getDb();
      const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
      if (!run) return reply.code(404).send({ error: "Run not found" });
      const testCases = db
        .prepare(
          `SELECT * FROM test_cases WHERE run_id = ?
           ORDER BY CASE status WHEN 'failed' THEN 0 WHEN 'error' THEN 1 WHEN 'skipped' THEN 2 ELSE 3 END,
           suite_name, test_name`
        )
        .all(id);
      return { run, testCases };
    }
  );

  fastify.delete(
    "/api/runs/:id",
    { preHandler: requireToken },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const db = getDb();
      const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
      if (!run) return reply.code(404).send({ error: "Run not found" });
      const runDir = getRunDir(id);
      try {
        await fsp.rm(runDir, { recursive: true, force: true });
      } catch {}
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

  fastify.get(
    "/api/runs/:id/monocart-reports",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const db = getDb();
      const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as any;
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
      } catch {}
      reports.sort((a, b) => a.name.localeCompare(b.name));
      return { reports };
    }
  );
}
