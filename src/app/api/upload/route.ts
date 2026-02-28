import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getRunDir, REPORTS_DIR } from "@/lib/reports";
import { parseJUnitXml } from "@/lib/parsers/junit";
import { parseLcov } from "@/lib/parsers/coverage";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { extract } from "tar";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const authError = requireToken(request);
  if (authError) return authError;

  const formData = await request.formData();
  const archive = formData.get("archive") as File | null;
  const runId = formData.get("run_id") as string | null;
  const githubRunId = formData.get("github_run_id") as string | null;
  const branch = formData.get("branch") as string | null;
  const commitSha = formData.get("commit_sha") as string | null;
  const prNumber = formData.get("pr_number") as string | null;
  const phase = formData.get("phase") as string | null;
  const triggeredBy = formData.get("triggered_by") as string | null;

  if (!archive || !runId || !githubRunId || !branch || !commitSha || !phase) {
    return NextResponse.json(
      { error: "Missing required fields: archive, run_id, github_run_id, branch, commit_sha, phase" },
      { status: 400 }
    );
  }

  const db = getDb();
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "e2e-upload-"));

  try {
    // Save the archive to temp
    const archiveBuffer = Buffer.from(await archive.arrayBuffer());
    const archivePath = path.join(tmpDir, "upload.tar.gz");
    await fsp.writeFile(archivePath, archiveBuffer);

    // Create run record in uploading state
    db.prepare(`
      INSERT OR REPLACE INTO runs (id, github_run_id, branch, commit_sha, pr_number, phase, triggered_by, status, upload_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', ?)
    `).run(runId, githubRunId, branch, commitSha, prNumber ? parseInt(prNumber) : null, phase, triggeredBy, archiveBuffer.length);

    // Extract archive
    const extractDir = path.join(tmpDir, "extracted");
    await fsp.mkdir(extractDir, { recursive: true });
    await extract({ file: archivePath, cwd: extractDir });

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

    // Set up report directory
    const runDir = getRunDir(runId);
    await fsp.mkdir(runDir, { recursive: true });

    // Copy monocart report
    if (hasMonocart) {
      const monocartDest = path.join(runDir, "monocart");
      await copyDir(monocartPaths[0], monocartDest);
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
          // Check if this video belongs to a failed test
          const videoDir = path.dirname(videoPath);
          const dirName = path.basename(videoDir);
          const isFailedTest = failedTestNames.size === 0 || // If no JUnit data, keep all videos
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

    const insertMany = db.transaction((cases: typeof junitResult extends null ? never : NonNullable<typeof junitResult>["testCases"]) => {
      for (const tc of cases) {
        const videoFile = hasVideos
          ? findVideoForTest(path.join(runDir, "videos"), tc.testName)
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

    return NextResponse.json({
      success: true,
      runId,
      status,
      totalTests: junitResult?.totalTests || 0,
      coverage: coverageResult?.lineCoveragePct || null,
    });
  } catch (error) {
    // Mark run as partial on error
    db.prepare("UPDATE runs SET status = 'partial' WHERE id = ?").run(runId);
    console.error("Upload processing error:", error);
    return NextResponse.json(
      { error: "Failed to process upload", details: String(error) },
      { status: 500 }
    );
  } finally {
    // Clean up temp directory
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
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

function findVideoForTest(videosDir: string, testName: string): string | null {
  try {
    if (!fs.existsSync(videosDir)) return null;
    const files = fs.readdirSync(videosDir);
    const normalized = testName.toLowerCase().replace(/\s+/g, "-");
    const match = files.find((f) => f.toLowerCase().includes(normalized));
    return match ? `/reports/videos/${match}` : null;
  } catch {
    return null;
  }
}
