import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import { FastifyInstance } from "fastify";

export default fp(async function multipartPlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024, // 2GB max archive size
      files: 1,
    },
  });
});
