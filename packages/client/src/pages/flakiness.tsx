import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  CategoryScale, LinearScale, PointElement, LineElement, LineController,
  Filler, Tooltip, Legend,
} from "chart.js";
import type { FlakinessResponse, FlakyTest, TrendsResponse } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip, Legend);

function flakClass(rate: number): string {
  if (rate >= 10) return "flak-high";
  if (rate >= 5) return "flak-mid";
  return "flak-low";
}

export function Flakiness() {
  const [data, setData] = useState<FlakinessResponse | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterSuite, setFilterSuite] = useState("");
  const [days, setDays] = useState("30");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days });
    Promise.all([
      apiFetch<FlakinessResponse>(`/api/flakiness?${params}`),
      apiFetch<TrendsResponse>(`/api/trends?days=${days}`),
    ])
      .then(([f, t]) => { if (f) setData(f); if (t) setTrends(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    if (!trends || !canvasRef.current) return;
    chartRef.current?.destroy();

    const labels = trends.trends.map(t =>
      new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    const flakData = trends.trends.map(t => t.flaky_rate ?? 0);

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: flakData,
          borderColor: "#d97706",
          backgroundColor: "rgba(217,119,6,.1)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#d97706",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${(ctx.raw as number)?.toFixed(2)}% flakiness` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
          y: { min: 0, ticks: { callback: v => `${v}%` }, grid: { color: "#f1f5f9" } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, [trends]);

  const suites = useMemo(() =>
    data ? Array.from(new Set(data.tests.map(t => t.suite_name))).sort() : [],
    [data]
  );

  const filtered = useMemo(() => (data?.tests ?? []).filter(t => {
    const matchQ = !q || t.test_name.toLowerCase().includes(q.toLowerCase()) || t.suite_name.toLowerCase().includes(q.toLowerCase());
    const matchSuite = !filterSuite || t.suite_name === filterSuite;
    return matchQ && matchSuite;
  }), [data, q, filterSuite]);

  const summary = data?.summary;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (loading) {
    return (
      <>
        <header className="topbar"><h1 className="topbar-title">Flakiness</h1></header>
        <div className="skeleton skeleton-hero" />
        <div className="content">
          <div className="skeleton skeleton-chart" style={{ height: 240 }} />
          <div className="card">{[...Array(6)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <h1 className="topbar-title">Flakiness</h1>
        <div className="topbar-controls">
          <select className="select-pill" value={days} onChange={e => setDays(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <span className="date-badge">{today}</span>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="hero-stat" style={{ padding: "32px 36px 28px", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div className="hero-stat-item">
          <div className="stat-label">Flaky Tests</div>
          <div className="stat-number">{summary?.total_flaky ?? 0}</div>
          <div className="stat-sub">in last {days} days</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-accent" style={{ background: "var(--warn)" }} />
          <div className="stat-label">Avg Rate</div>
          <div className="stat-number amber">
            {summary?.avg_rate != null ? summary.avg_rate.toFixed(1) : "0.0"}
            <span style={{ fontSize: 28 }}>%</span>
          </div>
          <div className="stat-sub">across flaky tests</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">Affected Runs</div>
          <div className="stat-number">{summary?.affected_runs ?? 0}</div>
          <div className="stat-sub">had failures</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">Top Suite</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--navy)", letterSpacing: "-.3px", marginBottom: 8, marginTop: 4 }}>
            {summary?.most_affected_suite ?? "—"}
          </div>
          <div className="stat-sub">most affected</div>
        </div>
      </div>

      <div className="content">
        {/* Trend Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Flakiness Rate Trend</span>
            <span className="card-meta">{days}-day rolling · all branches</span>
          </div>
          <div className="card-body" style={{ height: 200, position: "relative" }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Flaky Tests Table */}
        <div className="card table-card">
          <div className="flak-search-row">
            <div className="flak-search-wrap" style={{ position: "relative" }}>
              <svg className="flak-search-icon" aria-hidden="true" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="5.5" cy="5.5" r="4"/><line x1="8.7" y1="8.7" x2="12" y2="12"/>
              </svg>
              <input
                className="flak-search"
                type="search"
                placeholder="Search tests or suites…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select className="filter-select" value={filterSuite} onChange={e => setFilterSuite(e.target.value)}>
              <option value="">All suites</option>
              {suites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--gray-500)" }}>
              {filtered.length} test{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              {data?.tests.length === 0
                ? <><strong>No flaky tests detected</strong>Run a few test cycles to detect flakiness</>
                : <><strong>No matching tests</strong>Try adjusting your search</>
              }
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Suite</th>
                    <th aria-sort="descending">Flaky Rate</th>
                    <th>Total Runs</th>
                    <th>Fail Count</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={`${t.suite_name}::${t.test_name}`} style={{ cursor: "default" }}>
                      <td className="test-name-cell">{t.test_name}</td>
                      <td><span className="suite-tag">{t.suite_name}</span></td>
                      <td>
                        <span className={`flak-badge ${flakClass(t.flaky_rate)}`}>
                          {t.flaky_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="mono">{t.total_runs}</td>
                      <td className="mono">{t.fail_count}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--gray-500)" }}>
                        {formatRelativeTime(t.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
