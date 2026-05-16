import { FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import { UPLOAD_TOKEN } from "../config.js";

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
