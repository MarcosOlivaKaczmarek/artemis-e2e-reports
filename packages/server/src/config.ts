import path from "path";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "reports.db");
export const REPORTS_DIR = path.join(DATA_DIR, "reports");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");

const rawPort = parseInt(process.env.PORT || "3000", 10);
export const PORT = rawPort > 0 && rawPort < 65536 ? rawPort : 3000;
// BIND_HOST preferred; HOSTNAME is a common OS env var on Linux and may shadow the desired value
export const HOST = process.env.BIND_HOST || process.env.HOSTNAME || "0.0.0.0";

export const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const SESSION_SECRET = process.env.SESSION_SECRET || "";
export const APP_URL = process.env.APP_URL || "http://localhost:3000";
export const GITHUB_REPO = process.env.GITHUB_REPO || "ls1intum/Artemis";
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

export const AUTH_ENABLED = !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

if (AUTH_ENABLED && SESSION_SECRET.length < 32) {
  throw new Error("[config] SESSION_SECRET must be at least 32 characters when auth is enabled. Set SESSION_SECRET env var.");
}
if (!UPLOAD_TOKEN) {
  console.warn("[auth] UPLOAD_TOKEN is not set — upload endpoint is disabled");
}

export function getRunDir(runId: string): string {
  return path.join(REPORTS_DIR, runId);
}
