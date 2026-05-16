import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";

interface TrendsQuery {
  days?: string;
  branch?: string;
}

export default async function trendsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: TrendsQuery }>(
    "/api/trends",
    {},
    async (request) => {
      const { days: daysStr, branch } = request.query;
      const days = Math.min(Math.max(parseInt(daysStr || "30") || 30, 1), 365);

      const db = getDb();
      const daysParam = `-${days} days`;

      const baseSql = `SELECT
            date(created_at) as date,
            COUNT(*) as runs,
            AVG(CASE WHEN total_tests > 0 THEN (passed_tests * 100.0 / total_tests) ELSE NULL END) as avg_pass_rate,
            AVG(coverage_pct) as avg_coverage,
            SUM(total_tests) as total_tests,
            SUM(passed_tests) as total_passed,
            SUM(failed_tests) as total_failed,
            AVG(CASE WHEN phase = 'phase1' THEN duration_ms ELSE NULL END) as avg_phase1_ms,
            AVG(CASE WHEN phase = 'phase2' THEN duration_ms ELSE NULL END) as avg_phase2_ms
          FROM runs
          WHERE created_at >= datetime('now', ?)
            AND status IN ('success', 'failure')`;

      const runTrends = branch
        ? db.prepare(`${baseSql} AND branch = ? GROUP BY date(created_at) ORDER BY date(created_at) ASC`).all(daysParam, branch) as Record<string, unknown>[]
        : db.prepare(`${baseSql} GROUP BY date(created_at) ORDER BY date(created_at) ASC`).all(daysParam) as Record<string, unknown>[];

      // Compute per-day flakiness from test_cases (% of tests that failed in at least one run that day)
      const flakySql = `SELECT
            date(r.created_at) as date,
            COUNT(DISTINCT CASE WHEN tc.status IN ('failed', 'error') THEN tc.test_name END) * 100.0
              / NULLIF(COUNT(DISTINCT tc.test_name), 0) as flaky_rate
          FROM test_cases tc
          JOIN runs r ON tc.run_id = r.id
          WHERE r.created_at >= datetime('now', ?)
            AND r.status IN ('success', 'failure')`;

      const flakyByDay = new Map<string, number>();
      const flakyRows = branch
        ? db.prepare(`${flakySql} AND r.branch = ? GROUP BY date(r.created_at)`).all(daysParam, branch) as { date: string; flaky_rate: number | null }[]
        : db.prepare(`${flakySql} GROUP BY date(r.created_at)`).all(daysParam) as { date: string; flaky_rate: number | null }[];
      for (const row of flakyRows) {
        if (row.flaky_rate != null) flakyByDay.set(row.date, row.flaky_rate);
      }

      const trends = runTrends.map(t => ({
        ...t,
        flaky_rate: flakyByDay.get(t.date as string) ?? 0,
      }));

      // Get branches for filter
      const branches = db
        .prepare("SELECT DISTINCT branch FROM runs ORDER BY branch")
        .all() as { branch: string }[];

      // Summary stats for the selected period
      const summary = db
        .prepare(`
          SELECT
            COUNT(*) as total_runs,
            AVG(CASE WHEN total_tests > 0 THEN (passed_tests * 100.0 / total_tests) ELSE NULL END) as pass_rate,
            AVG(coverage_pct) as avg_coverage
          FROM runs
          WHERE created_at >= datetime('now', ?)
            AND status IN ('success', 'failure')
        `)
        .get(daysParam) as {
          total_runs: number;
          pass_rate: number | null;
          avg_coverage: number | null;
        };

      // Cross-run flakiness for the selected period
      const flakinessRow = db
        .prepare(`
          SELECT COUNT(DISTINCT CASE WHEN tc.status IN ('failed', 'error') THEN tc.test_name END) * 100.0
            / NULLIF(COUNT(DISTINCT tc.test_name), 0) as avg_flakiness
          FROM test_cases tc
          JOIN runs r ON tc.run_id = r.id
          WHERE r.created_at >= datetime('now', ?)
            AND r.status IN ('success', 'failure')
        `)
        .get(daysParam) as { avg_flakiness: number | null };

      let activePrsSql = "SELECT COUNT(DISTINCT pr_number) as count FROM runs WHERE pr_number IS NOT NULL AND reports_deleted = 0 AND created_at >= datetime('now', ?)";
      const activePrsParams: (string | number)[] = [daysParam];
      if (branch) {
        activePrsSql += " AND branch = ?";
        activePrsParams.push(branch);
      }
      const activePrs = db.prepare(activePrsSql).get(...activePrsParams) as { count: number };

      return {
        trends,
        branches: branches.map((b) => b.branch),
        summary: {
          total_runs: summary.total_runs,
          pass_rate: summary.pass_rate,
          avg_coverage: summary.avg_coverage,
          active_prs: activePrs.count,
          avg_flakiness: flakinessRow.avg_flakiness,
        },
      };
    }
  );
}
