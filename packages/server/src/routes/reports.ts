import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import fs from "fs";
import { REPORTS_DIR } from "../config.js";
import { requireAuth } from "../guards/auth-guard.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/reports/*",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const segments = (request.params as Record<string, string>)["*"];

      if (segments.includes("\0") || segments.includes("..")) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const filePath = path.join(REPORTS_DIR, segments);
      const resolved = path.resolve(filePath);

      if (!resolved.startsWith(path.resolve(REPORTS_DIR))) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return reply.code(404).send({ error: "Not found" });
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext];
      if (!contentType) {
        return reply.code(403).send({ error: "Forbidden file type" });
      }

      const stream = fs.createReadStream(resolved);
      return reply
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=3600")
        .send(stream);
    }
  );
}
