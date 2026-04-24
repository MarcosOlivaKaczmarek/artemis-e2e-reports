import path from "path";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "reports.db");
export const REPORTS_DIR = path.join(DATA_DIR, "reports");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");

export const PORT = parseInt(process.env.PORT || "3000", 10);
export const HOST = process.env.HOSTNAME || "0.0.0.0";

export const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const SESSION_SECRET = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
export const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

export const AUTH_ENABLED = !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

export function getRunDir(runId: string): string {
  return path.join(REPORTS_DIR, runId);
}
