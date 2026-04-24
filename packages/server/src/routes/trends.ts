import type { FastifyInstance, FastifyRequest } from "fastify";
import { getDb } from "../db.js";
import { requireAuth } from "../guards/auth-guard.js";

export default async function trendsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/trends",
    { preHandler: requireAuth },
    async (request: FastifyRequest) => {
      const { days: daysStr, branch } = request.query as Record<string, string>;
      const days = Math.min(parseInt(daysStr || "30"), 365);
      const branchFilter = branch || "develop";
      const db = getDb();

      const trends = db
        .prepare(
          `SELECT
            date(created_at) as date,
            COUNT(*) as runs,
            AVG(CASE WHEN total_tests > 0 THEN (passed_tests * 100.0 / total_tests) ELSE NULL END) as avg_pass_rate,
            AVG(coverage_pct) as avg_coverage,
            SUM(total_tests) as total_tests,
            SUM(passed_tests) as total_passed,
            SUM(failed_tests) as total_failed
          FROM runs
          WHERE created_at >= datetime('now', ?)
            AND branch = ?
            AND status IN ('success', 'failure')
          GROUP BY date(created_at)
          ORDER BY date(created_at) ASC`
        )
        .all(`-${days} days`, branchFilter);

      const branches = db
        .prepare("SELECT DISTINCT branch FROM runs ORDER BY branch")
        .all() as { branch: string }[];

      const summary = db
        .prepare(
          `SELECT
            COUNT(*) as total_runs,
            AVG(CASE WHEN total_tests > 0 THEN (passed_tests * 100.0 / total_tests) ELSE NULL END) as pass_rate,
            AVG(coverage_pct) as avg_coverage
          FROM runs
          WHERE created_at >= datetime('now', '-7 days')
            AND status IN ('success', 'failure')`
        )
        .get() as { total_runs: number; pass_rate: number | null; avg_coverage: number | null };

      const activePrs = db
        .prepare(
          "SELECT COUNT(DISTINCT pr_number) as count FROM runs WHERE pr_number IS NOT NULL AND reports_deleted = 0"
        )
        .get() as { count: number };

      return {
        trends,
        branches: branches.map((b) => b.branch),
        summary: {
          total_runs: summary.total_runs,
          pass_rate: summary.pass_rate,
          avg_coverage: summary.avg_coverage,
          active_prs: activePrs.count,
        },
      };
    }
  );
}
