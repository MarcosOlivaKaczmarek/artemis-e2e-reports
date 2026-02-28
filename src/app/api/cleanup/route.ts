import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getRunDir } from "@/lib/reports";
import fsp from "fs/promises";

export async function POST(request: NextRequest) {
  const authError = requireToken(request);
  if (authError) return authError;

  const db = getDb();
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return NextResponse.json(
      { message: "GITHUB_TOKEN not configured — cleanup disabled. Add it to enable auto-cleanup." },
      { status: 200 }
    );
  }

  // Get distinct PR numbers with reports not yet deleted
  const prs = db
    .prepare(
      "SELECT DISTINCT pr_number FROM runs WHERE pr_number IS NOT NULL AND reports_deleted = 0"
    )
    .all() as { pr_number: number }[];

  let cleaned = 0;
  let errors = 0;

  for (const { pr_number } of prs) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/ls1intum/Artemis/pulls/${pr_number}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      if (!response.ok) continue;

      const pr = await response.json();

      if (pr.state === "closed") {
        // Get all runs for this PR
        const runs = db
          .prepare(
            "SELECT id FROM runs WHERE pr_number = ? AND reports_deleted = 0"
          )
          .all(pr_number) as { id: string }[];

        for (const run of runs) {
          try {
            const runDir = getRunDir(run.id);
            await fsp.rm(runDir, { recursive: true, force: true });
          } catch {
            // Directory might not exist
          }
        }

        // Mark reports as deleted in DB (keep stats)
        db.prepare(
          "UPDATE runs SET reports_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE pr_number = ?"
        ).run(pr_number);

        cleaned += runs.length;
      }
    } catch (error) {
      console.error(`Error checking PR #${pr_number}:`, error);
      errors++;
    }
  }

  return NextResponse.json({
    cleaned,
    errors,
    prsChecked: prs.length,
  });
}
