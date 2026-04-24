import { FastifyInstance } from "fastify";
import { REPORTS_DIR } from "../config.js";
import { requireAuth } from "../guards/auth-guard.js";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

interface ReportsParams {
  "*": string;
}

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: ReportsParams }>(
    "/reports/*",
    { preHandler: requireAuth },
    async (request, reply) => {
      const segments = request.params["*"];

      // Reject null bytes and encoded traversal
      if (segments.includes("\0") || segments.includes("..")) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const filePath = path.join(REPORTS_DIR, segments);
      const resolved = path.resolve(filePath);

      // Prevent path traversal
      if (!resolved.startsWith(path.resolve(REPORTS_DIR))) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      let stat: Awaited<ReturnType<typeof fsp.stat>>;
      try {
        stat = await fsp.stat(resolved);
      } catch {
        return reply.code(404).send({ error: "Not found" });
      }

      if (!stat.isFile()) {
        return reply.code(404).send({ error: "Not found" });
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext];

      // Only serve known file types
      if (!contentType) {
        return reply.code(403).send({ error: "Forbidden file type" });
      }

      const stream = fs.createReadStream(resolved);
      // Don't cache HTML (contains CSP-dependent inline scripts); cache assets long-term
      const cacheControl = ext === ".html" ? "no-cache, no-store, must-revalidate" : "public, max-age=86400";
      return reply
        .header("Content-Type", contentType)
        .header("Cache-Control", cacheControl)
        .send(stream);
    }
  );
}
