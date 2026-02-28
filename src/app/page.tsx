import { getDb } from "@/lib/db";
import { auth, authEnabled } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Run, TrendPoint } from "@/lib/types";
import { SummaryCards } from "@/components/summary-cards";
import { PassRateChart, CoverageChart } from "@/components/trend-charts";
import { RunsTable } from "@/components/runs-table";
import { DashboardFilters } from "@/components/dashboard-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

interface DashboardProps {
  searchParams: Promise<{
    page?: string;
    branch?: string;
    status?: string;
    pr_number?: string;
  }>;
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  if (authEnabled) {
    const session = await auth();
    if (!session?.user) {
      redirect("/api/auth/signin");
    }
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const limit = 20;
  const db = getDb();

  // Build query conditions
  const conditions: string[] = [];
  const queryParams: (string | number)[] = [];

  if (params.branch) {
    conditions.push("branch = ?");
    queryParams.push(params.branch);
  }
  if (params.status) {
    conditions.push("status = ?");
    queryParams.push(params.status);
  }
  if (params.pr_number) {
    conditions.push("pr_number = ?");
    queryParams.push(parseInt(params.pr_number));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get runs
  const runs = db
    .prepare(`SELECT * FROM runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...queryParams, limit, (page - 1) * limit) as Run[];

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM runs ${where}`)
    .get(...queryParams) as { count: number };

  // Summary stats (last 7 days)
  const summary = db
    .prepare(`
      SELECT
        COUNT(*) as total_runs,
        AVG(CASE WHEN total_tests > 0 THEN (passed_tests * 100.0 / total_tests) ELSE NULL END) as pass_rate,
        AVG(coverage_pct) as avg_coverage
      FROM runs
      WHERE created_at >= datetime('now', '-7 days')
        AND status IN ('success', 'failure')
    `)
    .get() as { total_runs: number; pass_rate: number | null; avg_coverage: number | null };

  const activePrs = db
    .prepare("SELECT COUNT(DISTINCT pr_number) as count FROM runs WHERE pr_number IS NOT NULL AND reports_deleted = 0")
    .get() as { count: number };

  // Trends
  const trends = db
    .prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as runs,
        AVG(CASE WHEN total_tests > 0 THEN (passed_tests * 100.0 / total_tests) ELSE NULL END) as avg_pass_rate,
        AVG(coverage_pct) as avg_coverage,
        SUM(total_tests) as total_tests,
        SUM(passed_tests) as total_passed,
        SUM(failed_tests) as total_failed
      FROM runs
      WHERE created_at >= datetime('now', '-30 days')
        AND status IN ('success', 'failure')
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `)
    .all() as TrendPoint[];

  // Branches for filter
  const branches = db
    .prepare("SELECT DISTINCT branch FROM runs ORDER BY branch")
    .all() as { branch: string }[];

  const totalPages = Math.ceil(total.count / limit);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <SummaryCards
        data={{
          totalRuns: summary.total_runs,
          passRate: summary.pass_rate || 0,
          avgCoverage: summary.avg_coverage,
          activePrs: activePrs.count,
        }}
      />

      {trends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pass Rate (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <PassRateChart data={trends} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Coverage (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <CoverageChart data={trends} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Test Runs</CardTitle>
          <Suspense>
            <DashboardFilters branches={branches.map((b) => b.branch)} />
          </Suspense>
        </CardHeader>
        <CardContent>
          <RunsTable runs={runs} />

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {page > 1 && (
                <a
                  href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                  className="px-3 py-1 border rounded text-sm hover:bg-muted"
                >
                  Previous
                </a>
              )}
              <span className="px-3 py-1 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                  className="px-3 py-1 border rounded text-sm hover:bg-muted"
                >
                  Next
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
