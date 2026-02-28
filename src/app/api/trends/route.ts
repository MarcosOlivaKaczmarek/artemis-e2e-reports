import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30");
  const branch = searchParams.get("branch") || "develop";

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
    .all(`-${days} days`, branch);

  // Get branches for filter
  const branches = db
    .prepare("SELECT DISTINCT branch FROM runs ORDER BY branch")
    .all() as { branch: string }[];

  return NextResponse.json({
    trends,
    branches: branches.map((b) => b.branch),
  });
}
