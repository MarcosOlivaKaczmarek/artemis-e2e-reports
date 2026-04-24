import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import { FastifyInstance } from "fastify";

export default fp(async function multipartPlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max archive size
      files: 1,
    },
  });
});
