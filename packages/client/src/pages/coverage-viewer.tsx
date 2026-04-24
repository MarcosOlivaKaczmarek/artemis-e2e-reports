import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Run } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { statusClass } from "@/lib/utils";

export function CoverageViewer() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ run: Run; testCases: unknown[] }>(`/api/runs/${id}`)
      .then((data) => {
        const r = data.run;
        if (!r.has_coverage || r.reports_deleted) setNotFound(true);
        else setRun(r);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--gray-100)", animation: "pulse 1.5s infinite" }} />
    );
  }

  if (notFound || !run) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Coverage report not available</h1>
        <Link to={`/runs/${id}`} style={{ color: "var(--blue)", textDecoration: "none" }}>← Back to run</Link>
      </div>
    );
  }

  const sc = statusClass(run.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div className="topbar" style={{ gap: 12 }}>
        <Link to={`/runs/${id}`} className="back-btn">← Back to run</Link>
        <div className="topbar-divider" />
        <span className="branch-tag">{run.branch}</span>
        <span className="sha">{run.commit_sha.slice(0, 7)}</span>
        <span className={`status-chip ${sc}`}><span className="chip-dot" />{sc}</span>
        {run.coverage_pct != null && (
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 600 }}>
            {run.coverage_pct.toFixed(1)}% coverage
          </span>
        )}
        <span style={{ marginLeft: "auto", color: "var(--gray-500)", fontSize: 12 }}>Coverage Report</span>
      </div>
      <iframe
        src={`/reports/${id}/coverage/index.html`}
        style={{ flex: 1, width: "100%", border: "none" }}
        title="Coverage Report"
      />
    </div>
  );
}
