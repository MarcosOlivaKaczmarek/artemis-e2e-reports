import { FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AUTH_ENABLED, SESSION_SECRET, UPLOAD_TOKEN } from "../config.js";

export interface SessionUser {
  name: string;
  email: string;
  image: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}


export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!AUTH_ENABLED) return;

  const token = request.cookies?.session;
  if (!token) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, SESSION_SECRET, { algorithms: ["HS256"] }) as { user: SessionUser };
    request.user = decoded.user;
  } catch {
    reply.code(401).send({ error: "Invalid session" });
    return;
  }
}

export async function requireToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!UPLOAD_TOKEN) {
    reply.code(503).send({ error: "Upload endpoint is disabled — UPLOAD_TOKEN not configured" });
    return;
  }

  const authHeader = request.headers.authorization;
  const token = authHeader?.replace(/^Bearer /i, "");

  if (!token || !safeCompare(token, UPLOAD_TOKEN)) {
    reply.code(401).send({ error: "Invalid token" });
    return;
  }
}

/**
 * Timing-safe string comparison that does not leak the expected value's length.
 * Both strings are HMAC-SHA256 digested before comparison so timingSafeEqual
 * always operates on equal-length buffers.
 */
function safeCompare(a: string, b: string): boolean {
  const key = Buffer.from("token-comparison");
  const hashA = crypto.createHmac("sha256", key).update(a).digest();
  const hashB = crypto.createHmac("sha256", key).update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
