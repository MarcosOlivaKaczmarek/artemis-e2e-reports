import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { PORT, HOST } from "./config.js";
import { closeDb } from "./db.js";
import { startBackupScheduler } from "./backup.js";
import { startCleanupScheduler } from "./routes/cleanup.js";

// Plugins
import multipartPlugin from "./plugins/multipart.js";
import staticPlugin from "./plugins/static.js";

// Routes
import healthRoutes from "./routes/health.js";
import runsRoutes from "./routes/runs.js";
import trendsRoutes from "./routes/trends.js";
import uploadRoutes from "./routes/upload.js";
import backupRoutes from "./routes/backup.js";
import cleanupRoutes from "./routes/cleanup.js";
import reportsRoutes from "./routes/reports.js";
import flakinessRoutes from "./routes/flakiness.js";
import migrateVideosRoutes from "./routes/migrate-videos.js";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
  bodyLimit: 1024, // Small body limit for JSON routes; multipart handles file uploads
});

// CSP for the SPA (production Vite build — no eval needed)
const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; connect-src 'self'";
// Monocart/coverage reports use inline scripts — relax CSP for embedded report files
const REPORT_CSP = "default-src 'self' 'unsafe-inline' blob:; script-src 'self' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; object-src 'none'";

fastify.addHook("onSend", async (request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "SAMEORIGIN");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (request.url.startsWith("/reports/")) {
    // Embedded monocart/coverage reports need relaxed CSP
    reply.header("Content-Security-Policy", REPORT_CSP);
  } else if (!request.url.startsWith("/api/")) {
    // SPA routes
    reply.header("Content-Security-Policy", APP_CSP);
  }
  if (process.env.NODE_ENV === "production") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

async function start() {
  try {
    // Rate limiting
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      allowList: ["127.0.0.1"],
    });

    // Plugins
    await fastify.register(multipartPlugin);

    // Routes (register before static so API routes take precedence)
    await fastify.register(healthRoutes);
    await fastify.register(runsRoutes);
    await fastify.register(trendsRoutes);
    await fastify.register(uploadRoutes);
    await fastify.register(backupRoutes);
    await fastify.register(cleanupRoutes);
    await fastify.register(reportsRoutes);
    await fastify.register(flakinessRoutes);

    await fastify.register(migrateVideosRoutes);

    // Static files (SPA serving) — must be last
    await fastify.register(staticPlugin);

    // Start server
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on ${HOST}:${PORT}`);

    // Start schedulers — backup returns a stop fn for graceful shutdown
    const stopBackups = startBackupScheduler();
    startCleanupScheduler();

    const shutdown = async (sig: string) => {
      console.log(`[server] ${sig} received, shutting down`);
      stopBackups();
      await fastify.close();
      closeDb();
      process.exit(0);
    };
    for (const sig of ["SIGTERM", "SIGINT"] as const) {
      process.once(sig, () => { shutdown(sig).catch(console.error); });
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
