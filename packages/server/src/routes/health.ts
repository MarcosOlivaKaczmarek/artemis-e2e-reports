import type { FastifyInstance } from "fastify";
import { getDb } from "../db.js";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/api/health", async () => {
    try {
      const db = getDb();
      const row = db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number };
      return {
        status: "ok",
        runs: row.count,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error",
        message: String(error),
      };
    }
  });
}
