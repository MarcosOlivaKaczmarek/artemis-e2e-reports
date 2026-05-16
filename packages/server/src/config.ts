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

export const GITHUB_REPO = process.env.GITHUB_REPO || "ls1intum/Artemis";

if (!UPLOAD_TOKEN) {
  console.warn("[auth] UPLOAD_TOKEN is not set — upload endpoint is disabled");
}

export function getRunDir(runId: string): string {
  return path.join(REPORTS_DIR, runId);
}
