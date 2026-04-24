import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Run, TestCase } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { formatDuration, formatPhase, statusClass, passRate, shortRunId, GITHUB_REPO } from "@/lib/utils";

// Width % for each phase bar in a combined "all" run (leaves a visible gap between the two bars)
const COMBINED_PHASE_PCT = 48;

function ResultBadge({ tc }: { tc: TestCase }) {
  if (tc.status === "passed") return <span className="result-badge pass">✓ pass</span>;
  if (tc.status === "failed" || tc.status === "error") return <span className="result-badge fail">✕ fail</span>;
  if (tc.status === "skipped") return <span className="result-badge skip">— skip</span>;
  return null;
}

type TabKey = "all" | "failed" | "passed";

function VideoPlayer({ videoPath }: { videoPath: string }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <div className="video-section">
      <button
        className={`video-toggle${open ? " active" : ""}`}
        onClick={() => {
          if (open && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
          setOpen(x => !x);
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
          <path d="M2 2l9 4.5L2 11z"/>
        </svg>
        {open ? "Hide recording" : "Watch recording"}
      </button>
      {open && (
        <div className="video-player-wrap open">
          <video controls preload="none" ref={videoRef}>
            <source src={videoPath} type="video/webm" />
            <source src={videoPath.replace(".webm", ".mp4")} type="video/mp4" />
          </video>
          <div className="video-meta-bar">
            <span>Playwright recording</span>
            <a href={videoPath} download>Download</a>
          </div>
        </div>
      )}
    </div>
  );
}

export function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<{ run: Run; testCases: TestCase[] }>(`/api/runs/${id}`)
      .then(d => { setRun(d.run); setTestCases(d.testCases); })
      .catch(err => { if (err.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleRow = useCallback((tcId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(tcId)) next.delete(tcId); else next.add(tcId);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <>
        <header className="topbar"><h1 className="topbar-title">Loading…</h1></header>
        <div className="skeleton" style={{ height: 160 }} />
      </>
    );
  }

  if (notFound || !run) {
    return (
      <>
        <header className="topbar"><h1 className="topbar-title">Run not found</h1></header>
        <div className="content">
          <p style={{ color: "var(--gray-500)" }}>
            <Link to="/runs" style={{ color: "var(--blue)" }}>← Back to Runs</Link>
          </p>
        </div>
      </>
    );
  }

  const sc = statusClass(run.status);
  const pr = passRate(run.passed_tests, run.total_tests);

  const failed = testCases.filter(t => t.status === "failed" || t.status === "error");
  const passed = testCases.filter(t => t.status === "passed");

  const tabMap: Record<TabKey, TestCase[]> = { all: testCases, failed, passed };
  const visible = tabMap[activeTab];
  const PAGE = 25;
  const shown = showAll ? visible : visible.slice(0, PAGE);

  // Phase breakdown — show 100% for single-phase runs, 50/50 for combined ("all") since per-phase durations aren't available
  const phaseEntries: { name: string; pct: number; cls: "p1" | "p2" }[] = [];
  if (run.phase === "phase1") phaseEntries.push({ name: "Phase 1", pct: 100, cls: "p1" });
  else if (run.phase === "phase2") phaseEntries.push({ name: "Phase 2", pct: 100, cls: "p2" });
  else if (run.phase === "all") {
    phaseEntries.push({ name: "Phase 1", pct: COMBINED_PHASE_PCT, cls: "p1" });
    phaseEntries.push({ name: "Phase 2", pct: COMBINED_PHASE_PCT, cls: "p2" });
  }

  const startTime = new Date(run.created_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  return (
    <>
      {/* Topbar */}
      <header className="topbar">
        <Link to="/runs" className="back-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="9,2 4,7 9,12"/>
          </svg>
          Runs
        </Link>
        <div className="topbar-divider" />
        <span className="topbar-crumb">
          <strong>Run #{shortRunId(run.id)}</strong>
        </span>
        <span className="topbar-spacer" />
        <span className={`status-pill ${sc}`}>
          <span className="dot" />
          {sc === "pass" ? "Passed" : "Failed"}
        </span>
      </header>

      {/* Run Header */}
      <div className="run-header">
        <div className="run-id-row">
          <span className="run-id">Run #{shortRunId(run.id)}</span>
          <span className={`status-chip ${sc}`}><span className="chip-dot" />{sc === "pass" ? "Passed" : "Failed"}</span>
          <span className="phase-badge">{formatPhase(run.phase)}</span>
          {!run.reports_deleted && (run.has_monocart || run.has_coverage) ? (
            <div className="report-buttons">
              {run.has_monocart ? (
                <button type="button" className="report-btn" onClick={() => navigate(`/runs/${id}/monocart`)}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="12" height="12" rx="2"/><path d="M4.5 5.5h6M4.5 8h4M4.5 10.5h5"/></svg>
                  Monocart Report
                </button>
              ) : null}
              {run.has_coverage ? (
                <button type="button" className="report-btn" onClick={() => navigate(`/runs/${id}/coverage`)}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 11.5l3.5-5 3 3.5 2.5-4 3 5"/><rect x="1.5" y="1.5" width="12" height="12" rx="2"/></svg>
                  Coverage Report
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="run-meta-grid">
          <div className="run-meta-item">
            <div className="meta-label">Branch</div>
            <div className="meta-value"><span className="branch-tag">{run.branch}</span></div>
          </div>
          {run.pr_number && (
            <div className="run-meta-item">
              <div className="meta-label">Pull Request</div>
              <div className="meta-value">
                <a className="pr-link" href={`https://github.com/${GITHUB_REPO}/pull/${run.pr_number}`} target="_blank" rel="noopener noreferrer">#{run.pr_number}</a>
              </div>
            </div>
          )}
          <div className="run-meta-item">
            <div className="meta-label">Commit</div>
            <div className="meta-mono">{run.commit_sha.slice(0, 7)}</div>
          </div>
          {run.triggered_by && (
            <div className="run-meta-item">
              <div className="meta-label">Triggered by</div>
              <div className="meta-mono">{run.triggered_by}</div>
            </div>
          )}
          <div className="run-meta-item">
            <div className="meta-label">Started</div>
            <div className="meta-mono" style={{ fontSize: 11 }}>{startTime}</div>
          </div>
          <div className="run-meta-item">
            <div className="meta-label">Duration</div>
            <div className="meta-mono">{formatDuration(run.duration_ms)}</div>
          </div>
        </div>
      </div>

      <div className="content">
        {run.reports_deleted && (
          <div className="deleted-notice">Report files have been cleaned up (PR closed). Statistics are preserved.</div>
        )}

        {/* Stat Tiles */}
        <div className="stat-row">
          {[
            { label: "Total", value: run.total_tests.toLocaleString(), cls: "" },
            { label: "Passed", value: run.passed_tests.toLocaleString(), cls: "green" },
            { label: "Pass Rate", value: `${pr.toFixed(1)}%`, cls: "tile-mono" },
            { label: "Failed", value: run.failed_tests.toLocaleString(), cls: run.failed_tests > 0 ? "red" : "" },
            { label: "Flaky / Skipped", value: `${run.flaky_tests} / ${run.skipped_tests}`, cls: "tile-mono" },
          ].map(s => (
            <div key={s.label} className="stat-tile-detail">
              <div className="tile-label-detail">{s.label}</div>
              <div className={`tile-value-detail ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Phase Breakdown */}
        {phaseEntries.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Phase Breakdown</span>
              <span className="card-meta">{formatDuration(run.duration_ms)} total</span>
            </div>
            <div className="phase-timeline">
              {phaseEntries.map(p => (
                <div key={p.name} className="phase-row">
                  <span className="phase-name">{p.name}</span>
                  <div className="phase-bar-wrap">
                    <div className={`phase-bar ${p.cls}`} style={{ width: `${p.pct}%` }}>{p.name}</div>
                  </div>
                  <span className="phase-dur">{p.pct < 50 ? "" : formatDuration(run.duration_ms * p.pct / 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="card">
          <div className="seg-tabs" role="tablist">
            {(["all", "failed", "passed"] as TabKey[]).map(tab => {
              const count = tabMap[tab].length;
              const isActive = activeTab === tab;
              const colorCls = tab === "failed" && count > 0 ? " seg-fail" : tab === "passed" ? " seg-pass" : "";
              return (
                <button
                  type="button"
                  role="tab"
                  key={tab}
                  aria-selected={isActive}
                  className={`seg-tab${isActive ? " active" : ""}${colorCls}`}
                  onClick={() => { setActiveTab(tab); setShowAll(false); }}
                >
                  <span className="seg-label">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                  <span className="seg-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Test</th>
                  <th>Suite</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(tc => {
                  const isFail = tc.status === "failed" || tc.status === "error";
                  const isExpanded = expandedRows.has(tc.id);
                  return (
                    <Fragment key={tc.id}>
                      <tr
                        onClick={() => isFail && toggleRow(tc.id)}
                        style={{ cursor: isFail ? "pointer" : "default" }}
                      >
                        <td><ResultBadge tc={tc} /></td>
                        <td className={`test-name${isFail ? " fail-row" : ""}`}>{tc.test_name}</td>
                        <td><span className="suite-tag">{tc.suite_name}</span></td>
                        <td className="dur-mono">{formatDuration(tc.duration_ms)}</td>
                      </tr>
                      {isFail && isExpanded && (
                        <tr className="error-row">
                          <td colSpan={4}>
                            {tc.failure_message && (
                              <div className="error-block">
                                {tc.failure_message}
                                {tc.failure_details && `\n\n${tc.failure_details.slice(0, 800)}${tc.failure_details.length > 800 ? "\n…" : ""}`}
                              </div>
                            )}
                            {tc.has_video && tc.video_path && !run.reports_deleted && (
                              <VideoPlayer videoPath={tc.video_path} />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {visible.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--gray-500)" }}>No tests in this category</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {!showAll && visible.length > PAGE && (
            <button type="button" className="show-all-btn" onClick={() => setShowAll(true)}>
              Show all {visible.length} tests
            </button>
          )}
        </div>
      </div>
    </>
  );
}
