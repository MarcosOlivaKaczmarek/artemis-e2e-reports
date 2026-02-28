import path from "path";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const REPORTS_DIR = path.join(DATA_DIR, "reports");

export function getRunDir(runId: string): string {
  return path.join(REPORTS_DIR, runId);
}
