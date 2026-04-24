import { FastifyInstance } from "fastify";
import { getDb } from "../db.js";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/api/health", async (_request, reply) => {
    try {
      const db = getDb();
      const row = db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number };
      return {
        status: "ok",
        runs: row.count,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error(error, "[health] Database check failed");
      return reply.code(503).send({ status: "error" });
    }
  });
}
