import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";
import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";

export default fp(async function staticPlugin(fastify: FastifyInstance) {
  // Serve the built Vite SPA
  const clientDistPath = path.resolve(
    process.env.CLIENT_DIST_PATH || path.join(import.meta.dirname, "../../client/dist")
  );

  if (!fs.existsSync(clientDistPath)) {
    fastify.log.warn(`Client dist not found at ${clientDistPath}, skipping static file serving`);
    return;
  }

  await fastify.register(fastifyStatic, {
    root: clientDistPath,
    prefix: "/",
    wildcard: false,
    decorateReply: true,
  });

  // SPA fallback: serve index.html for all non-API, non-reports routes
  fastify.setNotFoundHandler(async (request, reply) => {
    const url = request.url;

    // Don't serve SPA for API or report routes
    if (url.startsWith("/api/") || url.startsWith("/reports/")) {
      return reply.code(404).send({ error: "Not found" });
    }

    // Serve index.html for client-side routing
    return reply.sendFile("index.html");
  });
});
