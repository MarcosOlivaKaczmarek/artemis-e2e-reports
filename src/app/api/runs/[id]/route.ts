import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";

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
