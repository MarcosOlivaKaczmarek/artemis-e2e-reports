import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Run } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

export function CoverageViewer() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ run: Run }>(`/api/runs/${id}`)
      .then((data) => {
        const r = data.run;
        if (!r.has_coverage || r.reports_deleted) {
          setNotFound(true);
        } else {
          setRun(r);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (notFound || !run) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Coverage report not available</h1>
        <Link to={`/runs/${id}`} className="text-muted-foreground hover:underline">
          Back to run
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-4 p-3 border-b bg-background shrink-0">
        <Link to={`/runs/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to run
        </Link>
        <span className="text-sm font-medium">{run.branch}</span>
        <span className="text-sm font-mono text-muted-foreground">{run.commit_sha.slice(0, 7)}</span>
        <StatusBadge status={run.status} />
        {run.coverage_pct != null && (
          <span className="text-sm font-medium">{run.coverage_pct.toFixed(1)}%</span>
        )}
        <span className="text-sm text-muted-foreground ml-auto">Coverage Report</span>
      </div>
      <iframe
        src={`/reports/${id}/coverage/index.html`}
        className="flex-1 w-full border-0"
        title="Coverage Report"
      />
    </div>
  );
}
