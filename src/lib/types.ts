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
  has_monocart: number;
  has_coverage: number;
  has_videos: number;
  upload_size_bytes: number;
  reports_deleted: number;
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
  has_video: number;
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
}

export interface PaginatedResponse<T> {
  runs: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
