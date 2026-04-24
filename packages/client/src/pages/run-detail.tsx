import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Run, TestCase } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

export function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<{ run: Run; testCases: TestCase[] }>(`/api/runs/${id}`)
      .then((data) => {
        setRun(data.run);
        setTestCases(data.testCases);
      })
      .catch((e) => {
        if (e.status === 404) setNotFound(true);
        console.error("Failed to load run:", e);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Run not found</h1>
        <Link to="/" className="text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const failedTests = testCases.filter((t) => t.status === "failed" || t.status === "error");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-muted-foreground hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <StatusBadge status={run.status} />
            {run.branch}
          </h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{run.commit_sha.slice(0, 7)}</span>
            {run.pr_number && (
              <a
                href={`https://github.com/ls1intum/Artemis/pull/${run.pr_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                PR #{run.pr_number}
              </a>
            )}
            <span>Phase: {run.phase}</span>
            <span>{new Date(run.created_at).toLocaleString()}</span>
            <span>{formatDuration(run.duration_ms)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {run.has_monocart && !run.reports_deleted ? (
            <Link to={`/runs/${id}/monocart`}>
              <Button variant="outline" size="sm">View Monocart Report</Button>
            </Link>
          ) : null}
          {run.has_coverage && !run.reports_deleted ? (
            <Link to={`/runs/${id}/coverage`}>
              <Button variant="outline" size="sm">View Coverage Report</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {run.reports_deleted ? (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          Report files have been cleaned up (PR closed). Statistics are preserved below.
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.total_tests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{run.passed_tests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{run.failed_tests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Skipped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.skipped_tests}</div>
          </CardContent>
        </Card>
      </div>

      {run.coverage_pct != null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Line Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.coverage_pct.toFixed(1)}%</div>
            <div className="mt-2 w-full bg-muted rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(run.coverage_pct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {failedTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-600">
              Failed Tests ({failedTests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {failedTests.map((tc) => (
              <div key={tc.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{tc.test_name}</div>
                    <div className="text-sm text-muted-foreground">{tc.suite_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{formatDuration(tc.duration_ms)}</span>
                    <StatusBadge status={tc.status} />
                  </div>
                </div>
                {tc.failure_message && (
                  <div className="text-sm bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                    <div className="font-medium text-red-800 dark:text-red-200">{tc.failure_message}</div>
                    {tc.failure_details && (
                      <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-700 dark:text-red-300 max-h-60 overflow-y-auto">
                        {tc.failure_details}
                      </pre>
                    )}
                  </div>
                )}
                {tc.has_video && tc.video_path && !run.reports_deleted ? (
                  <a
                    href={tc.video_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-blue-600 hover:underline"
                  >
                    Watch video
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {testCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              All Tests ({testCases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {testCases.map((tc) => (
                <div
                  key={tc.id}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={tc.status} />
                    <span className="truncate">{tc.test_name}</span>
                  </div>
                  <span className="text-muted-foreground ml-2 shrink-0">
                    {formatDuration(tc.duration_ms)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
