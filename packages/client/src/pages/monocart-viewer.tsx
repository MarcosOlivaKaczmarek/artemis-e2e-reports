import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import type { Run } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

interface MonocartReport {
  name: string;
  label: string;
  path: string;
}

export function MonocartViewer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const selectedReport = searchParams.get("report");

  const [run, setRun] = useState<Run | null>(null);
  const [reports, setReports] = useState<MonocartReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<{ run: Run }>(`/api/runs/${id}`),
      apiFetch<{ reports: MonocartReport[] }>(`/api/runs/${id}/monocart-reports`),
    ])
      .then(([runData, reportsData]) => {
        const r = runData.run;
        if (!r.has_monocart || r.reports_deleted || reportsData.reports.length === 0) {
          setNotFound(true);
        } else {
          setRun(r);
          setReports(reportsData.reports);
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
        <h1 className="text-2xl font-bold mb-2">Monocart report not available</h1>
        <Link to={`/runs/${id}`} className="text-muted-foreground hover:underline">
          Back to run
        </Link>
      </div>
    );
  }

  const active = reports.find((r) => r.name === selectedReport) || reports[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-4 p-3 border-b bg-background shrink-0">
        <Link
          to={`/runs/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to run
        </Link>
        <span className="text-sm font-medium">{run.branch}</span>
        <span className="text-sm font-mono text-muted-foreground">
          {run.commit_sha.slice(0, 7)}
        </span>
        <StatusBadge status={run.status} />
        {reports.length > 1 ? (
          <div className="flex gap-1 ml-auto">
            {reports.map((r) => (
              <Link
                key={r.name}
                to={`/runs/${id}/monocart?report=${r.name}`}
                className={`text-sm px-3 py-1 rounded-md ${
                  r.name === active.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground ml-auto">
            Monocart Report
          </span>
        )}
      </div>
      <iframe
        key={active.name}
        src={active.path}
        className="flex-1 w-full border-0"
        title={`Monocart Report - ${active.label}`}
      />
    </div>
  );
}
