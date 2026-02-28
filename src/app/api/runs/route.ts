import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");
  const prNumber = searchParams.get("pr_number");

  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (branch) {
    conditions.push("branch = ?");
    params.push(branch);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (prNumber) {
    conditions.push("pr_number = ?");
    params.push(parseInt(prNumber));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM runs ${where}`)
    .get(...params) as { count: number };

  const runs = db
    .prepare(
      `SELECT * FROM runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return NextResponse.json({
    runs,
    pagination: {
      page,
      limit,
      total: total.count,
      totalPages: Math.ceil(total.count / limit),
    },
  });
}
