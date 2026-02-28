import { getDb } from "@/lib/db";
import { auth, authEnabled } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Run, TestCase } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds % 60}s`;
}

export default async function RunDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (authEnabled) {
    const session = await auth();
    if (!session?.user) {
      redirect("/api/auth/signin");
    }
  }

  const { id } = await params;
  const db = getDb();

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
  if (!run) {
    notFound();
  }

  const testCases = db
    .prepare(
      "SELECT * FROM test_cases WHERE run_id = ? ORDER BY CASE status WHEN 'failed' THEN 0 WHEN 'error' THEN 1 WHEN 'skipped' THEN 2 ELSE 3 END, suite_name, test_name"
    )
    .all(id) as TestCase[];

  const failedTests = testCases.filter(
    (t) => t.status === "failed" || t.status === "error"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-muted-foreground hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      {/* Header */}
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
            <Link href={`/runs/${id}/monocart`}>
              <Button variant="outline" size="sm">
                View Monocart Report
              </Button>
            </Link>
          ) : null}
          {run.has_coverage && !run.reports_deleted ? (
            <Link href={`/runs/${id}/coverage`}>
              <Button variant="outline" size="sm">
                View Coverage Report
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {run.reports_deleted ? (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          Report files have been cleaned up (PR closed). Statistics are preserved below.
        </div>
      ) : null}

      {/* Test Summary */}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Line Coverage
            </CardTitle>
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

      {/* Failed Tests */}
      {failedTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-600">
              Failed Tests ({failedTests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {failedTests.map((test) => (
              <div key={test.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{test.test_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {test.suite_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(test.duration_ms)}
                    </span>
                    <StatusBadge status={test.status} />
                  </div>
                </div>
                {test.failure_message && (
                  <div className="text-sm bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                    <div className="font-medium text-red-800 dark:text-red-200">
                      {test.failure_message}
                    </div>
                    {test.failure_details && (
                      <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-700 dark:text-red-300 max-h-60 overflow-y-auto">
                        {test.failure_details}
                      </pre>
                    )}
                  </div>
                )}
                {test.has_video && test.video_path && !run.reports_deleted ? (
                  <a
                    href={test.video_path}
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

      {/* All Test Cases */}
      {testCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              All Tests ({testCases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {testCases.map((test) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={test.status} />
                    <span className="truncate">{test.test_name}</span>
                  </div>
                  <span className="text-muted-foreground ml-2 shrink-0">
                    {formatDuration(test.duration_ms)}
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
