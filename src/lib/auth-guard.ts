import { NextRequest, NextResponse } from "next/server";
import { auth, authEnabled } from "./auth";

export async function requireAuth(): Promise<NextResponse | null> {
  if (!authEnabled) return null;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function requireToken(request: NextRequest): NextResponse | null {
  const uploadToken = process.env.UPLOAD_TOKEN;
  if (!uploadToken) return null; // No token configured = open access
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token !== uploadToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  return null;
}
