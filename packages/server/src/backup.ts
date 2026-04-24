import { getDb } from "./db.js";
import { BACKUP_DIR } from "./config.js";
import fs from "fs";
import path from "path";

const MAX_BACKUPS = 5;

export async function createBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `reports-${timestamp}.db`);

  const db = getDb();
  await db.backup(backupPath);

  // Prune old backups, keep only MAX_BACKUPS most recent
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("reports-") && f.endsWith(".db"))
    .sort()
    .reverse();

  for (const old of backups.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old));
  }

  return backupPath;
}

export function startBackupScheduler(): () => void {
  const initialTimer = setTimeout(async () => {
    try {
      const p = await createBackup();
      console.log(`[backup] Initial backup: ${p}`);
    } catch (e) {
      console.error("[backup] Initial backup failed:", e);
    }
  }, 60_000);

  const interval = setInterval(async () => {
    try {
      const p = await createBackup();
      console.log(`[backup] Scheduled backup: ${p}`);
    } catch (e) {
      console.error("[backup] Scheduled backup failed:", e);
    }
  }, 6 * 60 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}
