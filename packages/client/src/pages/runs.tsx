import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Run, PaginatedResponse } from "@artemis-e2e/shared";
import { apiFetch } from "@/lib/api";
import { formatDuration, formatDateKey, formatPhase, statusClass, passRate, shortRunId, GITHUB_REPO } from "@/lib/utils";

type SortKey = "date-desc" | "date-asc" | "passrate-asc" | "passrate-desc" | "duration-asc" | "duration-desc";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface RunCardProps {
  run: Run;
  showSpine: boolean;
  isLastInGroup: boolean;
}

function RunCard({ run, showSpine, isLastInGroup }: RunCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const sc = statusClass(run.status);
  const pr = passRate(run.passed_tests, run.total_tests);

  // Phase bar widths are proportional within the available space (not real duration %)
  const p1Pct = run.phase === "phase1" ? 100 : run.phase === "all" ? 50 : 0;
  const p2Pct = run.phase === "phase2" ? 100 : run.phase === "all" ? 50 : 0;

  return (
    <div className={`run-entry${showSpine ? "" : " no-spine"}${isLastInGroup ? " last-in-group" : ""}`}>
      {showSpine && (
        <div className="spine">
          <div className={`spine-dot ${sc}`} />
          <div className="spine-line" />
        </div>
      )}
      <div className={`run-card ${sc}-card${expanded ? " expanded" : ""}`}>
        <div
          className="card-overview"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={() => setExpanded(x => !x)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(x => !x); } }}
        >
          <div className="overview-main">
            <div className="overview-title">
              {run.pr_number && (
                <a
                  className="run-card-pr"
                  href={`https://github.com/${GITHUB_REPO}/pull/${run.pr_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                >#{run.pr_number}</a>
              )}
              <span className="run-card-branch">{run.branch}</span>
              <span className="run-id-tag">#{shortRunId(run.id)}</span>
            </div>
            <div className="overview-top">
              <span className="phase-badge">{formatPhase(run.phase)}</span>
              <span className="commit-mono">{run.commit_sha.slice(0, 7)}</span>
              <span className="overview-top-spacer" />
              <span className={`status-chip ${sc}`}><span className="chip-dot" />{sc === "pass" ? "Passed" : "Failed"}</span>
            </div>
            <div className="overview-bottom">
              <span className="meta"><strong>{run.total_tests.toLocaleString()}</strong> tests</span>
              <div className="pass-bar-outer">
                <div className="pass-bar-bg"><div className="pass-bar-fill" style={{ width: `${pr}%` }} /></div>
                <span className="meta"><strong>{pr.toFixed(1)}%</strong> pass</span>
              </div>
              {run.failed_tests > 0 && <span className="meta fail-c"><strong>{run.failed_tests}</strong> failed</span>}
              {run.flaky_tests > 0 && <span className="meta warn-c"><strong>{run.flaky_tests}</strong> flaky</span>}
              <span className="meta">{formatDuration(run.duration_ms)}</span>
              <span className="meta">{fmtTime(run.created_at)}</span>
            </div>
          </div>
          <div className="overview-aside">
            <button className="expand-btn" aria-label={expanded ? "Collapse details" : "Expand details"}>
              Details
              <span className="chevron">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="2,4 6,8 10,4" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="card-detail">
          <div className="detail-stats">
            {[
              { label: "Total", value: run.total_tests.toLocaleString(), cls: "" },
              { label: "Passed", value: run.passed_tests.toLocaleString(), cls: "green" },
              { label: "Pass Rate", value: `${pr.toFixed(1)}%`, cls: "tile-mono" },
              { label: "Failed", value: run.failed_tests.toLocaleString(), cls: run.failed_tests > 0 ? "red" : "" },
              { label: "Flaky", value: run.flaky_tests.toLocaleString(), cls: run.flaky_tests > 0 ? "amber" : "" },
            ].map(s => (
              <div key={s.label} className="stat-tile">
                <div className="tile-label">{s.label}</div>
                <div className={`tile-value ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {(p1Pct > 0 || p2Pct > 0) && (
            <div className="detail-phases">
              <div className="phases-label">Phase Breakdown</div>
              {p1Pct > 0 && (
                <div className="ph-row">
                  <span className="ph-name">Phase 1</span>
                  <div className="ph-bar-wrap"><div className="ph-bar p1" style={{ width: `${p1Pct}%` }}>Phase 1</div></div>
                  <span className="ph-dur">{run.phase !== "all" ? formatDuration(run.duration_ms) : ""}</span>
                </div>
              )}
              {p2Pct > 0 && (
                <div className="ph-row">
                  <span className="ph-name">Phase 2</span>
                  <div className="ph-bar-wrap"><div className="ph-bar p2" style={{ width: `${p2Pct}%` }}>Phase 2</div></div>
                  <span className="ph-dur">{run.phase !== "all" ? formatDuration(run.duration_ms) : ""}</span>
                </div>
              )}
            </div>
          )}

          <div className="detail-actions">
            <button className="action-btn primary" onClick={e => { e.stopPropagation(); navigate(`/runs/${run.id}`); }}>
              Full Report →
            </button>
            {run.pr_number && (
              <a className="action-btn" href={`https://github.com/${GITHUB_REPO}/pull/${run.pr_number}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                View PR ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Runs() {
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPhase, setFPhase] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRuns = useCallback((query: string, status: string, phase: string) => {
    const params = new URLSearchParams({ limit: "100" });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (phase) params.set("phase", phase);
    apiFetch<PaginatedResponse<Run>>(`/api/runs?${params}`)
      .then(r => { if (r?.items) setAllRuns(r.items); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchRuns(q, fStatus, fPhase), q ? 200 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, fStatus, fPhase, fetchRuns]);

  const byDate = sort === "date-desc" || sort === "date-asc";

  const sorted = useMemo(() => [...allRuns].sort((a, b) => {
    if (sort === "date-desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "date-asc")  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sort === "passrate-desc") return passRate(b.passed_tests, b.total_tests) - passRate(a.passed_tests, a.total_tests);
    if (sort === "passrate-asc")  return passRate(a.passed_tests, a.total_tests) - passRate(b.passed_tests, b.total_tests);
    if (sort === "duration-desc") return b.duration_ms - a.duration_ms;
    if (sort === "duration-asc")  return a.duration_ms - b.duration_ms;
    return 0;
  }), [allRuns, sort]);

  const groups = useMemo(() => {
    if (!byDate) return [];
    const map = new Map<string, Run[]>();
    for (const r of sorted) {
      const k = formatDateKey(r.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([key, runs]) => ({ key, runs }));
  }, [sorted, byDate]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="topbar-title">Runs</h1>
          <span className="topbar-count" aria-live="polite">
            {!loading && `${sorted.length} result${sorted.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </header>

      <div className="toolbar" role="search" aria-label="Filter and sort runs">
        <div className="search-wrap">
          <svg className="search-icon" aria-hidden="true" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="5.5" cy="5.5" r="4"/><line x1="8.7" y1="8.7" x2="12" y2="12"/>
          </svg>
          <label className="sr-only" htmlFor="q">Search runs</label>
          <input
            className="search-input" id="q" type="search"
            placeholder="Branch, PR #, commit, run ID…"
            value={q} onChange={e => setQ(e.target.value)}
          />
        </div>

        <label className="sr-only" htmlFor="f-status">Status</label>
        <select className="filter-select" id="f-status" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="success">Passed</option>
          <option value="failure">Failed</option>
        </select>

        <label className="sr-only" htmlFor="f-phase">Phase</label>
        <select className="filter-select" id="f-phase" value={fPhase} onChange={e => setFPhase(e.target.value)}>
          <option value="">All phases</option>
          <option value="phase1">Phase 1</option>
          <option value="phase2">Phase 2</option>
          <option value="all">All Tests</option>
        </select>

        <div className="toolbar-sep" aria-hidden="true" />

        <label className="sr-only" htmlFor="sort">Sort by</label>
        <select className="sort-select" id="sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="passrate-desc">Pass rate ↓</option>
          <option value="passrate-asc">Pass rate ↑</option>
          <option value="duration-desc">Duration ↓</option>
          <option value="duration-asc">Duration ↑</option>
        </select>
      </div>

      <div className="list-container">
        {loading ? (
          [...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 8, marginBottom: 8 }} />)
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <strong>No runs found</strong>
            Try adjusting your search or filters
          </div>
        ) : byDate ? (
          groups.map(group => (
            <div key={group.key} className="day-group">
              <div className="day-header">
                <span className="day-header-text">{group.key}</span>
                <span className="day-count">{group.runs.length} run{group.runs.length !== 1 ? "s" : ""}</span>
                <span className="day-rule" aria-hidden="true" />
              </div>
              {group.runs.map((run, i) => (
                <RunCard
                  key={run.id}
                  run={run}
                  showSpine={true}
                  isLastInGroup={i === group.runs.length - 1}
                />
              ))}
            </div>
          ))
        ) : (
          sorted.map(run => (
            <RunCard key={run.id} run={run} showSpine={false} isLastInGroup={false} />
          ))
        )}
      </div>
    </>
  );
}
