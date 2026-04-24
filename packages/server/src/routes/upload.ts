import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db.js";
import { getRunDir } from "../config.js";
import { pruneOldRuns } from "./cleanup.js";
import { parseJUnitXml } from "../parsers/junit.js";
import { parseLcov } from "../parsers/coverage.js";
import { requireToken } from "../guards/auth-guard.js";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { extract } from "tar";

export default async function uploadRoutes(fastify: FastifyInstance) {
  fastify.put(
    "/api/upload",
    { preHandler: requireToken },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parts = request.parts();
      const fields: Record<string, string> = {};
      let archiveBuffer: Buffer | null = null;

      for await (const part of parts) {
        if (part.type === "file") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          archiveBuffer = Buffer.concat(chunks);
        } else {
          fields[part.fieldname] = (part as any).value as string;
        }
      }

      const { run_id: runId, github_run_id: githubRunId, branch, commit_sha: commitSha, phase, pr_number: prNumber, triggered_by: triggeredBy } = fields;

      if (!archiveBuffer || !runId || !githubRunId || !branch || !commitSha || !phase) {
        return reply.code(400).send({
          error: "Missing required fields: archive, run_id, github_run_id, branch, commit_sha, phase",
        });
      }

      // Validate input patterns
      if (!/^[\w-]+$/.test(runId) || !/^[\w-]+$/.test(githubRunId)) {
        return reply.code(400).send({ error: "Invalid run_id or github_run_id format" });
      }

      const db = getDb();
      const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "e2e-upload-"));

      try {
        // Save the archive to temp
        const archivePath = path.join(tmpDir, "upload.tar.gz");
        await fsp.writeFile(archivePath, archiveBuffer);

        // Clean up old data if re-uploading the same run
        db.prepare("DELETE FROM test_cases WHERE run_id = ?").run(runId);

        // Create run record in uploading state
        db.prepare(`
          INSERT OR REPLACE INTO runs (id, github_run_id, branch, commit_sha, pr_number, phase, triggered_by, status, upload_size_bytes)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', ?)
        `).run(runId, githubRunId, branch, commitSha, prNumber ? parseInt(prNumber) : null, phase, triggeredBy || null, archiveBuffer.length);

        // Extract archive
        const extractDir = path.join(tmpDir, "extracted");
        await fsp.mkdir(extractDir, { recursive: true });

        // Validate archive before extraction
        await extract({ file: archivePath, cwd: extractDir });

        // Validate no path traversal in extracted files
        const entries = await fsp.readdir(extractDir, { withFileTypes: true, recursive: true });
        const resolvedExtractDir = path.resolve(extractDir);
        for (const entry of entries) {
          const entryPath = path.resolve(path.join(entry.parentPath || entry.path, entry.name));
          if (!entryPath.startsWith(resolvedExtractDir)) {
            throw new Error("Path traversal detected in archive");
          }
        }

        // Parse JUnit XML
        let junitResult = null;
        const junitPaths = await findFiles(extractDir, "results.xml");
        if (junitPaths.length > 0) {
          const xmlContent = await fsp.readFile(junitPaths[0], "utf-8");
          junitResult = parseJUnitXml(xmlContent);
        }

        // Parse coverage
        let coverageResult = null;
        const lcovPaths = await findFiles(extractDir, "lcov.info");
        if (lcovPaths.length > 0) {
          const lcovContent = await fsp.readFile(lcovPaths[0], "utf-8");
          coverageResult = parseLcov(lcovContent);
        }

        // Check for monocart
        const monocartPaths = await findDirs(extractDir, "monocart-report");
        const hasMonocart = monocartPaths.length > 0;

        // Check for coverage HTML
        const coverageHtmlPaths = await findDirs(extractDir, "lcov-report");
        const hasCoverage = coverageHtmlPaths.length > 0;

        // Set up report directory (clean old files on re-upload)
        const runDir = getRunDir(runId);
        await fsp.rm(runDir, { recursive: true, force: true }).catch(() => {});
        await fsp.mkdir(runDir, { recursive: true });

        // Copy all monocart reports (parallel + sequential are separate)
        if (hasMonocart) {
          for (const monocartPath of monocartPaths) {
            const dirName = path.basename(monocartPath);
            const suffix = dirName.replace("monocart-report", "").replace(/^-/, "");
            const destName = suffix ? `monocart-${suffix}` : "monocart";
            await copyDir(monocartPath, path.join(runDir, destName));
          }
        }

        // Copy coverage HTML
        if (hasCoverage) {
          const coverageDest = path.join(runDir, "coverage");
          await copyDir(coverageHtmlPaths[0], coverageDest);
        }

        // Copy JUnit XML
        if (junitPaths.length > 0) {
          await fsp.copyFile(junitPaths[0], path.join(runDir, "results.xml"));
        }

        // Copy videos for failed tests only
        let hasVideos = false;
        const failedTestNames = new Set(
          junitResult?.testCases
            .filter((t) => t.status === "failed" || t.status === "error")
            .map((t) => t.testName) || []
        );

        const testResultsDir = await findDirs(extractDir, "test-results");
        if (testResultsDir.length > 0) {
          const videosDir = path.join(runDir, "videos");
          const videoFiles = await findFiles(testResultsDir[0], "*.webm");
          const mp4Files = await findFiles(testResultsDir[0], "*.mp4");
          const allVideos = [...videoFiles, ...mp4Files];

          if (allVideos.length > 0) {
            await fsp.mkdir(videosDir, { recursive: true });

            for (const videoPath of allVideos) {
              const videoDir = path.dirname(videoPath);
              const dirName = path.basename(videoDir);
              const isFailedTest = failedTestNames.size === 0 ||
                Array.from(failedTestNames).some((name) =>
                  dirName.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, "-"))
                );

              if (isFailedTest) {
                hasVideos = true;
                const destPath = path.join(videosDir, `${dirName}-${path.basename(videoPath)}`);
                await fsp.copyFile(videoPath, destPath);
              }
            }
          }
        }

        // Update test cases in DB
        const insertTestCase = db.prepare(`
          INSERT INTO test_cases (run_id, suite_name, test_name, classname, status, duration_ms, failure_message, failure_details, has_video, video_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((cases: NonNullable<typeof junitResult>["testCases"]) => {
          for (const tc of cases) {
            const videoFile = hasVideos
              ? findVideoForTest(path.join(runDir, "videos"), tc.testName, runId)
              : null;
            insertTestCase.run(
              runId,
              tc.suiteName,
              tc.testName,
              tc.classname,
              tc.status,
              tc.durationMs,
              tc.failureMessage || null,
              tc.failureDetails || null,
              videoFile ? 1 : 0,
              videoFile
            );
          }
        });

        if (junitResult) {
          insertMany(junitResult.testCases);
        }

        // Determine status
        const status = junitResult
          ? junitResult.failedTests > 0
            ? "failure"
            : "success"
          : "partial";

        // Update run record
        db.prepare(`
          UPDATE runs SET
            status = ?,
            total_tests = ?,
            passed_tests = ?,
            failed_tests = ?,
            skipped_tests = ?,
            duration_ms = ?,
            coverage_pct = ?,
            has_monocart = ?,
            has_coverage = ?,
            has_videos = ?
          WHERE id = ?
        `).run(
          status,
          junitResult?.totalTests || 0,
          junitResult?.passedTests || 0,
          junitResult?.failedTests || 0,
          junitResult?.skippedTests || 0,
          junitResult?.durationMs || 0,
          coverageResult?.lineCoveragePct || null,
          hasMonocart ? 1 : 0,
          hasCoverage ? 1 : 0,
          hasVideos ? 1 : 0,
          runId
        );

        const parsedPr = prNumber ? parseInt(prNumber) : null;
        if (parsedPr) {
          pruneOldRuns(parsedPr).catch((e) =>
            console.error("[retention] Post-upload prune failed:", e)
          );
        }
        return {
          success: true,
          runId,
          status,
          totalTests: junitResult?.totalTests || 0,
          coverage: coverageResult?.lineCoveragePct || null,
        };
      } catch (error) {
        db.prepare("UPDATE runs SET status = 'partial' WHERE id = ?").run(runId);
        console.error("Upload processing error:", error);
        return reply.code(500).send({
          error: "Failed to process upload",
          details: String(error),
        });
      } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  );
}

async function findFiles(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(entry.parentPath || entry.path, entry.name);
        if (pattern.startsWith("*")) {
          if (entry.name.endsWith(pattern.slice(1))) results.push(fullPath);
        } else if (entry.name === pattern) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

async function findDirs(dir: string, nameContains: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.includes(nameContains)) {
        results.push(path.join(entry.parentPath || entry.path, entry.name));
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, { recursive: true });
  await fsp.cp(src, dest, { recursive: true });
}

function findVideoForTest(videosDir: string, testName: string, runId: string): string | null {
  try {
    if (!fs.existsSync(videosDir)) return null;
    const files = fs.readdirSync(videosDir);
    const normalized = testName.toLowerCase().replace(/\s+/g, "-");
    const match = files.find((f) => f.toLowerCase().includes(normalized));
    return match ? `/reports/${runId}/videos/${match}` : null;
  } catch {
    return null;
  }
}
