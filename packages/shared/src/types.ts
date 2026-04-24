export interface Run {
  id: string;
  github_run_id: string;
  branch: string;
  commit_sha: string;
  pr_number: number | null;
  triggered_by: string | null;
  created_at: string;
  status: "uploading" | "success" | "failure" | "partial";
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  flaky_tests: number;
  duration_ms: number;
  coverage_pct: number | null;
  phase: string;
  has_monocart: boolean;
  has_coverage: boolean;
  has_videos: boolean;
  upload_size_bytes: number;
  reports_deleted: boolean;
  deleted_at: string | null;
}

export interface TestCase {
  id: number;
  run_id: string;
  suite_name: string;
  test_name: string;
  classname: string | null;
  status: "passed" | "failed" | "skipped" | "error";
  duration_ms: number;
  failure_message: string | null;
  failure_details: string | null;
  has_video: boolean;
  video_path: string | null;
}

export interface TrendPoint {
  date: string;
  runs: number;
  avg_pass_rate: number | null;
  avg_coverage: number | null;
  total_tests: number;
  total_passed: number;
  total_failed: number;
  avg_phase1_ms: number | null;
  avg_phase2_ms: number | null;
  flaky_rate: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SummaryStats {
  total_runs: number;
  pass_rate: number | null;
  avg_coverage: number | null;
  active_prs: number;
  avg_flakiness: number | null;
}

export interface TrendsResponse {
  trends: TrendPoint[];
  branches: string[];
  summary: SummaryStats;
}

export interface FlakyTest {
  suite_name: string;
  test_name: string;
  total_runs: number;
  fail_count: number;
  flaky_rate: number;
  last_seen: string;
}

export interface FlakinessResponse {
  tests: FlakyTest[];
  summary: {
    total_flaky: number;
    avg_rate: number;
    affected_runs: number;
    most_affected_suite: string | null;
  };
}
