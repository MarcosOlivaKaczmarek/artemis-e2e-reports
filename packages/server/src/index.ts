import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { PORT, HOST } from "./config.js";
import authPlugin from "./plugins/auth.js";
import multipartPlugin from "./plugins/multipart.js";
import staticPlugin from "./plugins/static.js";
import healthRoutes from "./routes/health.js";
import runsRoutes from "./routes/runs.js";
import trendsRoutes from "./routes/trends.js";
import uploadRoutes from "./routes/upload.js";
import backupRoutes from "./routes/backup.js";
import cleanupRoutes, { startCleanupScheduler } from "./routes/cleanup.js";
import authRoutes from "./routes/auth.js";
import reportsRoutes from "./routes/reports.js";
import { startBackupScheduler } from "./backup.js";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
  bodyLimit: 1024,
});

fastify.addHook("onSend", async (_request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "SAMEORIGIN");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

async function start() {
  try {
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      allowList: ["127.0.0.1"],
    });
    await fastify.register(authPlugin);
    await fastify.register(multipartPlugin);
    await fastify.register(healthRoutes);
    await fastify.register(runsRoutes);
    await fastify.register(trendsRoutes);
    await fastify.register(uploadRoutes);
    await fastify.register(backupRoutes);
    await fastify.register(cleanupRoutes);
    await fastify.register(authRoutes);
    await fastify.register(reportsRoutes);
    await fastify.register(staticPlugin);
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on ${HOST}:${PORT}`);
    startBackupScheduler();
    startCleanupScheduler();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
