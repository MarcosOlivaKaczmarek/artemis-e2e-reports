import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";

interface FlakinessQuery {
  days?: string;
  suite?: string;
}

export default async function flakinessRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: FlakinessQuery }>(
    "/api/flakiness",
    {},
    async (request) => {
      const { days: daysStr, suite } = request.query;
      const days = Math.min(parseInt(daysStr || "30") || 30, 365);

      const db = getDb();

      const daysParam = `-${days} days`;
      const conditions: string[] = [
        `r.created_at >= datetime('now', ?)`,
        `r.status IN ('success', 'failure')`,
      ];
      const params: (string | number)[] = [daysParam];

      if (suite) {
        conditions.push("tc.suite_name = ?");
        params.push(suite);
      }

      const where = `WHERE ${conditions.join(" AND ")}`;

      const tests = db
        .prepare(
          `SELECT
            tc.suite_name,
            tc.test_name,
            COUNT(DISTINCT tc.run_id) as total_runs,
            COUNT(DISTINCT CASE WHEN tc.status IN ('failed', 'error') THEN tc.run_id END) as fail_count,
            COUNT(DISTINCT CASE WHEN tc.status IN ('failed', 'error') THEN tc.run_id END) * 100.0
              / COUNT(DISTINCT tc.run_id) as flaky_rate,
            MAX(r.created_at) as last_seen
          FROM test_cases tc
          JOIN runs r ON tc.run_id = r.id
          ${where}
          GROUP BY tc.suite_name, tc.test_name
          HAVING fail_count > 0 AND fail_count < total_runs
          ORDER BY flaky_rate DESC
          LIMIT 200`
        )
        .all(...params);

      // Summary stats
      const totalFlaky = (tests as { flaky_rate: number }[]).length;
      const avgRate = totalFlaky > 0
        ? (tests as { flaky_rate: number }[]).reduce((sum, t) => sum + t.flaky_rate, 0) / totalFlaky
        : 0;

      // Count distinct runs that had at least one flaky test
      const affectedRunsRow = db
        .prepare(
          `SELECT COUNT(DISTINCT tc.run_id) as count
           FROM test_cases tc
           JOIN runs r ON tc.run_id = r.id
           WHERE r.created_at >= datetime('now', ?)
             AND r.status IN ('success', 'failure')
             AND tc.status IN ('failed', 'error')`
        )
        .get(daysParam) as { count: number };

      // Most affected suite
      const suiteCounts = (tests as { suite_name: string }[]).reduce(
        (acc: Record<string, number>, t) => {
          acc[t.suite_name] = (acc[t.suite_name] || 0) + 1;
          return acc;
        },
        {}
      );
      const mostAffectedSuite = Object.entries(suiteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        tests,
        summary: {
          total_flaky: totalFlaky,
          avg_rate: parseFloat(avgRate.toFixed(1)),
          affected_runs: affectedRunsRow.count,
          most_affected_suite: mostAffectedSuite,
        },
      };
    }
  );
}
