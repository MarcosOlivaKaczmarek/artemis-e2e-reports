import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";
import { getRunDir } from "../config.js";
import { requireToken } from "../guards/auth-guard.js";
import { extractVideoMap } from "../parsers/monocart.js";
import fsp from "fs/promises";
import path from "path";

export default async function migrateVideosRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/migrate-videos",
    { preHandler: requireToken },
    async () => {
      const db = getDb();

      const runs = db
        .prepare("SELECT id FROM runs WHERE has_monocart = 1 AND reports_deleted = 0")
        .all() as { id: string }[];

      let totalUpdated = 0;
      let runsProcessed = 0;

      const updateStmt = db.prepare(
        "UPDATE test_cases SET has_video = 1, video_path = ? WHERE id = ?"
      );
      const updateRunStmt = db.prepare(
        "UPDATE runs SET has_videos = 1 WHERE id = ?"
      );

      for (const run of runs) {
        const runDir = getRunDir(run.id);
        const videoMap = new Map<string, string>();

        try {
          const entries = await fsp.readdir(runDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith("monocart")) {
              const jsonPath = path.join(runDir, entry.name, "index.json");
              try {
                const jsonContent = await fsp.readFile(jsonPath, "utf-8");
                const monocartData = JSON.parse(jsonContent);
                extractVideoMap(monocartData.rows || [], videoMap, run.id, entry.name);
              } catch {
                // Skip malformed JSON
              }
            }
          }
        } catch {
          continue;
        }

        if (videoMap.size > 0) {
          // DB test names use "Suite › Describe › Test" format, monocart uses just "Test"
          // Match on the leaf segment of the DB test name
          const testCases = db
            .prepare("SELECT id, test_name FROM test_cases WHERE run_id = ? AND has_video = 0")
            .all(run.id) as { id: number; test_name: string }[];

          let runUpdated = 0;
          db.transaction(() => {
            for (const tc of testCases) {
              const leaf = tc.test_name.split(" › ").pop() || tc.test_name;
              const videoPath = videoMap.get(leaf) || videoMap.get(tc.test_name);
              if (videoPath) {
                updateStmt.run(videoPath, tc.id);
                runUpdated++;
              }
            }
            if (runUpdated > 0) {
              updateRunStmt.run(run.id);
            }
          })();

          if (runUpdated > 0) {
            totalUpdated += runUpdated;
            runsProcessed++;
          }
        }
      }

      return {
        runsScanned: runs.length,
        runsWithVideos: runsProcessed,
        testCasesUpdated: totalUpdated,
      };
    }
  );
}
