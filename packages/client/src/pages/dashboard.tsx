import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart,
  CategoryScale, LinearScale, PointElement, LineElement, LineController,
  Filler, Tooltip, Legend,
} from "chart.js";
import type { Run, PaginatedResponse, TrendsResponse } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import {
  formatDuration, formatRelativeTime, formatPhase,
  statusClass, passRate, GITHUB_REPO,
} from "@/lib/utils";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip, Legend);

const CHART_FONT = { family: "'JetBrains Mono', monospace", size: 11 };
const CHART_COLOR = "#6b7280";

export function Dashboard() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState("");
  const [days, setDays] = useState("30");

  const passCanvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeCanvasRef = useRef<HTMLCanvasElement>(null);
  const passChart = useRef<Chart | null>(null);
  const runtimeChart = useRef<Chart | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<TrendsResponse>(`/api/trends?days=${days}${branch ? `&branch=${branch}` : ""}`),
      apiFetch<PaginatedResponse<Run>>("/api/runs?limit=8"),
    ])
      .then(([t, r]) => { if (t) setTrends(t); if (r?.items) setRuns(r.items); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branch, days]);

  useEffect(() => {
    if (!trends || !passCanvasRef.current) return;
    passChart.current?.destroy();

    const labels = trends.trends.map(t =>
      new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    passChart.current = new Chart(passCanvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: trends.trends.map(t => t.avg_pass_rate ?? null),
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29,78,216,.08)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#1d4ed8",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        color: CHART_COLOR,
        font: CHART_FONT,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${(ctx.raw as number)?.toFixed(1)}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: CHART_FONT, color: CHART_COLOR } },
          y: { min: 0, max: 100, ticks: { callback: v => `${v}%`, font: CHART_FONT, color: CHART_COLOR }, grid: { color: "#f1f5f9" } },
        },
      },
    });
    return () => { passChart.current?.destroy(); };
  }, [trends]);

  useEffect(() => {
    if (!trends || !runtimeCanvasRef.current) return;
    const hasData = trends.trends.some(t => t.avg_phase1_ms != null || t.avg_phase2_ms != null);
    if (!hasData) return;
    runtimeChart.current?.destroy();

    const labels = trends.trends.map(t =>
      new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    const p1 = trends.trends.map(t => t.avg_phase1_ms != null ? Math.round(t.avg_phase1_ms / 60000 * 10) / 10 : null);
    const p2 = trends.trends.map(t => t.avg_phase2_ms != null ? Math.round(t.avg_phase2_ms / 60000 * 10) / 10 : null);
    const total = p1.map((v, i) => (v != null || p2[i] != null) ? Math.round(((v ?? 0) + (p2[i] ?? 0)) * 10) / 10 : null);

    runtimeChart.current = new Chart(runtimeCanvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Total", data: total, borderColor: "#6366f1", borderDash: [4, 3], borderWidth: 2, pointRadius: 0, tension: 0.4, order: 0 },
          { label: "Phase 1", data: p1, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,.08)", borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.4 },
          { label: "Phase 2", data: p2, borderColor: "#0f2044", backgroundColor: "rgba(15,32,68,.06)", borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        color: CHART_COLOR,
        font: CHART_FONT,
        plugins: {
          legend: { position: "top", align: "end", labels: { boxWidth: 12, padding: 12, font: CHART_FONT, color: CHART_COLOR } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw as number)?.toFixed(1)}m` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: CHART_FONT, color: CHART_COLOR } },
          y: { min: 0, ticks: { callback: v => `${v}m`, font: CHART_FONT, color: CHART_COLOR }, grid: { color: "#f1f5f9" } },
        },
      },
    });
    return () => { runtimeChart.current?.destroy(); };
  }, [trends]);

  const summary = trends?.summary;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const hasPhaseData = trends?.trends.some(t => t.avg_phase1_ms != null || t.avg_phase2_ms != null);

  if (loading) {
    return (
      <>
        <header className="topbar"><h1 className="topbar-title">Dashboard</h1></header>
        <div className="skeleton skeleton-hero" />
        <div className="content">
          <div className="charts-row">
            <div className="skeleton skeleton-chart" style={{ height: 260 }} />
            <div className="skeleton skeleton-chart" style={{ height: 260 }} />
          </div>
          <div className="card">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <h1 className="topbar-title">Dashboard</h1>
        <div className="topbar-controls">
          <select className="select-pill" value={branch} onChange={e => setBranch(e.target.value)}>
            <option value="">All branches</option>
            <option value="develop">develop</option>
            <option value="main">main</option>
            {trends?.branches.filter(b => b !== "develop" && b !== "main").map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="select-pill" value={days} onChange={e => setDays(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <span className="date-badge">{today}</span>
        </div>
      </header>

      <div className="hero-stat">
        <div className="hero-stat-item">
          <div className="stat-label">Total Runs</div>
          <div className="stat-number">{summary?.total_runs?.toLocaleString() ?? "—"}</div>
          <div className="stat-sub">last {days === "365" ? "year" : `${days} days`}</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-accent" />
          <div className="stat-label">Pass Rate</div>
          <div className="stat-number blue">
            {summary?.pass_rate != null ? summary.pass_rate.toFixed(1) : "—"}
            <span style={{ fontSize: 28 }}>%</span>
          </div>
          <div className="stat-sub">{days === "365" ? "1-year" : `${days}-day`} average</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">Avg Flakiness</div>
          <div className="stat-number amber">
            {summary?.avg_flakiness != null ? summary.avg_flakiness.toFixed(1) : "0.0"}
            <span style={{ fontSize: 28 }}>%</span>
          </div>
          <div className="stat-sub">{days === "365" ? "1-year" : `${days}-day`} average</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">Active PRs</div>
          <div className="stat-number">{summary?.active_prs ?? "—"}</div>
          <div className="stat-sub">with open reports</div>
        </div>
      </div>

      <div className="content">
        <div className="charts-row">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pass Rate Trend</span>
              <span className="card-meta">{days}-day rolling · {branch}</span>
            </div>
            <div className="card-body" style={{ height: 200, position: "relative" }}>
              <canvas ref={passCanvasRef} />
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Avg Runtime by Phase</span>
              <span className="card-meta">{days}-day · minutes</span>
            </div>
            <div className="card-body" style={{ height: 200, position: "relative" }}>
              {hasPhaseData
                ? <canvas ref={runtimeCanvasRef} />
                : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-500)", fontSize: 12 }}>No phase runtime data yet</div>
              }
            </div>
          </div>
        </div>

        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Recent Runs</span>
            <span className="card-meta">Showing {runs.length} most recent</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th><th>Branch</th><th>PR</th><th>Commit</th>
                  <th>Phase</th><th>Tests</th><th>Pass %</th><th>Duration</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const sc = statusClass(run.status);
                  const pr = passRate(run.passed_tests, run.total_tests);
                  return (
                    <tr key={run.id} onClick={() => navigate(`/runs/${run.id}`)}>
                      <td><span className="status-dot"><span className={`dot dot-${sc}`} />{sc}</span></td>
                      <td><span className="branch-tag">{run.branch}</span></td>
                      <td>
                        {run.pr_number
                          ? <a className="pr-link" href={`https://github.com/${GITHUB_REPO}/pull/${run.pr_number}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>#{run.pr_number}</a>
                          : <span style={{ color: "var(--gray-300)" }}>—</span>}
                      </td>
                      <td><span className="sha">{run.commit_sha.slice(0, 7)}</span></td>
                      <td><span className="phase-badge">{formatPhase(run.phase)}</span></td>
                      <td>{run.total_tests.toLocaleString()}</td>
                      <td>
                        <div className="pass-bar-wrap">
                          <div className="pass-bar-bg"><div className="pass-bar-fill" style={{ width: `${pr}%` }} /></div>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{pr.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="mono">{formatDuration(run.duration_ms)}</td>
                      <td style={{ color: "var(--gray-500)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{formatRelativeTime(run.created_at)}</td>
                    </tr>
                  );
                })}
                {!runs.length && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--gray-500)" }}>No runs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
