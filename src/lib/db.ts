import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "reports.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      github_run_id TEXT NOT NULL,
      branch TEXT NOT NULL,
      commit_sha TEXT NOT NULL,
      pr_number INTEGER,
      triggered_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'uploading',
      total_tests INTEGER DEFAULT 0,
      passed_tests INTEGER DEFAULT 0,
      failed_tests INTEGER DEFAULT 0,
      skipped_tests INTEGER DEFAULT 0,
      flaky_tests INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      coverage_pct REAL,
      phase TEXT NOT NULL,
      has_monocart BOOLEAN DEFAULT 0,
      has_coverage BOOLEAN DEFAULT 0,
      has_videos BOOLEAN DEFAULT 0,
      upload_size_bytes INTEGER DEFAULT 0,
      reports_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id),
      suite_name TEXT NOT NULL,
      test_name TEXT NOT NULL,
      classname TEXT,
      status TEXT NOT NULL,
      duration_ms INTEGER DEFAULT 0,
      failure_message TEXT,
      failure_details TEXT,
      has_video BOOLEAN DEFAULT 0,
      video_path TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runs_pr ON runs(pr_number);
    CREATE INDEX IF NOT EXISTS idx_runs_branch ON runs(branch);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_test_cases_run ON test_cases(run_id);
  `);
}
