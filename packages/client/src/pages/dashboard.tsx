import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Run, TrendPoint, SummaryStats, PaginatedResponse, TrendsResponse } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DashboardFilters } from "@/components/dashboard-filters";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryCards({ data }: { data: { totalRuns: number; passRate: number; avgCoverage: number | null; activePrs: number } }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Runs (7d)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalRuns}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.passRate.toFixed(1)}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.avgCoverage != null ? `${data.avgCoverage.toFixed(1)}%` : "N/A"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Active PRs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activePrs}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function PassRateChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
          formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "Pass Rate"]}
        />
        <Line type="monotone" dataKey="avg_pass_rate" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3 }} name="Pass Rate" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CoverageChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
          formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "Coverage"]}
        />
        <Area type="monotone" dataKey="avg_coverage" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.2} strokeWidth={2} name="Coverage" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RunsTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No runs found.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Branch / PR</TableHead>
          <TableHead>Commit</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead className="text-right">Tests</TableHead>
          <TableHead className="text-right">Pass</TableHead>
          <TableHead className="text-right">Fail</TableHead>
          <TableHead className="text-right">Coverage</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead className="text-right">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link to={`/runs/${run.id}`} className="hover:underline">
                <StatusBadge status={run.status} />
              </Link>
            </TableCell>
            <TableCell>
              <Link to={`/runs/${run.id}`} className="hover:underline font-medium">
                {run.branch}
              </Link>
              {run.pr_number && (
                <a
                  href={`https://github.com/ls1intum/Artemis/pull/${run.pr_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sm text-muted-foreground hover:underline"
                >
                  #{run.pr_number}
                </a>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">{run.commit_sha.slice(0, 7)}</TableCell>
            <TableCell>{run.phase}</TableCell>
            <TableCell className="text-right">{run.total_tests}</TableCell>
            <TableCell className="text-right text-green-600">{run.passed_tests}</TableCell>
            <TableCell className="text-right text-red-600">{run.failed_tests > 0 ? run.failed_tests : "-"}</TableCell>
            <TableCell className="text-right">
              {run.coverage_pct != null ? `${run.coverage_pct.toFixed(1)}%` : "-"}
            </TableCell>
            <TableCell className="text-right">{formatDuration(run.duration_ms)}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">{formatDate(run.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [runsData, setRunsData] = useState<PaginatedResponse<Run> | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const page = parseInt(searchParams.get("page") || "1");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(searchParams);
    if (!params.has("limit")) params.set("limit", "20");
    Promise.all([
      apiFetch<PaginatedResponse<Run>>(`/api/runs?${params.toString()}`),
      apiFetch<TrendsResponse>("/api/trends"),
    ])
      .then(([runs, trends]) => {
        setRunsData(runs);
        setTrendsData(trends);
      })
      .catch((e) => console.error("Failed to load dashboard:", e))
      .finally(() => setLoading(false));
  }, [searchParams]);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    navigate(`/?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const runs = runsData?.runs ?? [];
  const pagination = runsData?.pagination;
  const trends = trendsData?.trends ?? [];
  const branches = trendsData?.branches ?? [];
  const summary = trendsData?.summary;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {summary && (
        <SummaryCards
          data={{
            totalRuns: summary.total_runs,
            passRate: summary.pass_rate ?? 0,
            avgCoverage: summary.avg_coverage,
            activePrs: summary.active_prs,
          }}
        />
      )}

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
          <DashboardFilters branches={branches} />
        </CardHeader>
        <CardContent>
          <RunsTable runs={runs} />
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {page > 1 && (
                <button onClick={() => goToPage(page - 1)} className="px-3 py-1 border rounded text-sm hover:bg-muted">
                  Previous
                </button>
              )}
              <span className="px-3 py-1 text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              {page < pagination.totalPages && (
                <button onClick={() => goToPage(page + 1)} className="px-3 py-1 border rounded text-sm hover:bg-muted">
                  Next
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
