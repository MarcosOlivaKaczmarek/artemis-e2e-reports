import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { FastifyRequest, FastifyReply } from "fastify";
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

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!AUTH_ENABLED) return;
  const token = request.cookies?.session;
  if (!token) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as { user: SessionUser };
    request.user = decoded.user;
  } catch {
    reply.code(401).send({ error: "Invalid session" });
  }
}

export async function requireToken(request: FastifyRequest, reply: FastifyReply) {
  if (!UPLOAD_TOKEN) return;
  const authHeader = request.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token || !safeCompare(token, UPLOAD_TOKEN)) {
    reply.code(401).send({ error: "Invalid token" });
  }
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
