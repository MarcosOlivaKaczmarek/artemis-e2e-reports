import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number };
    return NextResponse.json({
      status: "ok",
      runs: row.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
