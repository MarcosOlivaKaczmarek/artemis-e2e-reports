import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireToken } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getRunDir } from "@/lib/reports";
import fsp from "fs/promises";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const db = getDb();

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const testCases = db
    .prepare("SELECT * FROM test_cases WHERE run_id = ? ORDER BY status DESC, suite_name, test_name")
    .all(id);

  return NextResponse.json({ run, testCases });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireToken(request);
  if (authError) return authError;

  const { id } = await params;
  const db = getDb();

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as { id: string; reports_deleted: number } | undefined;
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Delete report files from disk
  const runDir = getRunDir(id);
  try {
    await fsp.rm(runDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }

  // Mark as deleted in DB (keep stats)
  db.prepare(
    "UPDATE runs SET reports_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(id);

  return NextResponse.json({
    deleted: true,
    runId: id,
    message: "Report files deleted. Statistics preserved.",
  });
}
