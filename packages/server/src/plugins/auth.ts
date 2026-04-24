import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import oauth2 from "@fastify/oauth2";
import { FastifyInstance } from "fastify";
import { AUTH_ENABLED, SESSION_SECRET, APP_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from "../config.js";

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(cookie, {
    secret: SESSION_SECRET,
    parseOptions: {},
  });

  if (!AUTH_ENABLED) return;

  await fastify.register(oauth2, {
    name: "githubOAuth2",
    credentials: {
      client: {
        id: GITHUB_CLIENT_ID,
        secret: GITHUB_CLIENT_SECRET,
      },
      auth: oauth2.GITHUB_CONFIGURATION,
    },
    startRedirectPath: "/api/auth/login",
    callbackUri: `${APP_URL}/api/auth/callback`,
    scope: ["read:user", "user:email"],
  });
});
