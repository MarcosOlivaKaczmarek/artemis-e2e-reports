export function formatDuration(ms: number): string {
  if (ms <= 0 || ms < 1000) return `${Math.max(ms, 0)}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  const secs = seconds % 60;
  return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
}

export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 2) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function formatDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function formatPhase(phase: string): string {
  if (phase === "phase1") return "Phase 1";
  if (phase === "phase2") return "Phase 2";
  if (phase === "all") return "All Tests";
  return phase;
}

export function statusClass(status: string): "pass" | "fail" {
  return status === "success" ? "pass" : "fail";
}

export function passRate(passed: number, total: number): number {
  if (!total) return 0;
  return Math.round((passed / total) * 1000) / 10;
}

/** Extract short display ID from run ID (strips phase suffix like "-phase1", "-all") */
export function shortRunId(id: string): string {
  return id.replace(/-(phase\d+|all)$/, "").slice(-8);
}

/** GitHub repository used for PR links. Override via VITE_GITHUB_REPO at build time. */
export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? "ls1intum/Artemis";
