import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import type { Run } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { statusClass } from "@/lib/utils";

interface MonocartReport { name: string; label: string; path: string; }

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
      apiFetch<{ run: Run; testCases: unknown[] }>(`/api/runs/${id}`),
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
    return <div style={{ height: "100vh", background: "var(--gray-100)" }} />;
  }

  if (notFound || !run) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Monocart report not available</h1>
        <Link to={`/runs/${id}`} style={{ color: "var(--blue)", textDecoration: "none" }}>← Back to run</Link>
      </div>
    );
  }

  const active = reports.find(r => r.name === selectedReport) || reports[0];
  const sc = statusClass(run.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div className="topbar" style={{ gap: 12 }}>
        <Link to={`/runs/${id}`} className="back-btn">← Back to run</Link>
        <div className="topbar-divider" />
        <span className="branch-tag">{run.branch}</span>
        <span className="sha">{run.commit_sha.slice(0, 7)}</span>
        <span className={`status-chip ${sc}`}><span className="chip-dot" />{sc}</span>
        {reports.length > 1 ? (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {reports.map(r => (
              <Link
                key={r.name}
                to={`/runs/${id}/monocart?report=${r.name}`}
                className="action-btn"
                style={r.name === active.name ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" } : {}}
              >
                {r.label}
              </Link>
            ))}
          </div>
        ) : (
          <span style={{ marginLeft: "auto", color: "var(--gray-500)", fontSize: 12 }}>Monocart Report</span>
        )}
      </div>
      <iframe
        key={active.name}
        src={active.path}
        style={{ flex: 1, width: "100%", border: "none" }}
        title={`Monocart Report - ${active.label}`}
      />
    </div>
  );
}
