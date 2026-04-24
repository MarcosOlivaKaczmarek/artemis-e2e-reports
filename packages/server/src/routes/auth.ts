import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { AUTH_ENABLED, SESSION_SECRET, APP_URL } from "../config.js";
import type { SessionUser } from "../guards/auth-guard.js";

export default async function authRoutes(fastify: FastifyInstance) {
  // GET /api/auth/session - returns current user
  fastify.get("/api/auth/session", async (request) => {
    if (!AUTH_ENABLED) {
      return { authenticated: false, authEnabled: false };
    }

    const token = request.cookies?.session;
    if (!token) {
      return { authenticated: false, authEnabled: true };
    }

    try {
      const decoded = jwt.verify(token, SESSION_SECRET) as { user: SessionUser };
      return { authenticated: true, authEnabled: true, user: decoded.user };
    } catch {
      return { authenticated: false, authEnabled: true };
    }
  });

  // GET /api/auth/callback - OAuth callback
  fastify.get("/api/auth/callback", async (request, reply) => {
    if (!AUTH_ENABLED) {
      return reply.redirect("/");
    }

    try {
      const { token } = await (fastify as any).githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      // Fetch user info from GitHub
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!userResponse.ok) {
        return reply.code(401).send({ error: "Failed to fetch user info" });
      }

      const githubUser = await userResponse.json();

      const user: SessionUser = {
        name: githubUser.login || githubUser.name || "",
        email: githubUser.email || "",
        image: githubUser.avatar_url || "",
      };

      // Create JWT session cookie
      const sessionToken = jwt.sign({ user }, SESSION_SECRET, { expiresIn: "8h" });

      reply.setCookie("session", sessionToken, {
        path: "/",
        httpOnly: true,
        secure: APP_URL.startsWith("https"),
        sameSite: "strict",
        maxAge: 8 * 60 * 60, // 8 hours
      });

      return reply.redirect("/");
    } catch (error) {
      console.error("OAuth callback error:", error);
      return reply.code(500).send({ error: "Authentication failed" });
    }
  });

  // POST /api/auth/logout
  fastify.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie("session", { path: "/" });
    return { success: true };
  });
}
