import { FastifyInstance } from "fastify";
import { createBackup } from "../backup.js";
import { requireToken } from "../guards/auth-guard.js";

export default async function backupRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/backup",
    { preHandler: requireToken },
    async (_request, reply) => {
      try {
        await createBackup();
        return { success: true };
      } catch (e) {
        console.error("[backup] Manual backup failed:", e);
        return reply.code(500).send({ error: "Backup failed" });
      }
    }
  );
}
