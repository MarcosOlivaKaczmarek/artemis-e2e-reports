import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const authEnabled = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

export { authEnabled };

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: authEnabled
    ? [
        GitHub({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }),
      ]
    : [],
  callbacks: {
    authorized({ auth }) {
      if (!authEnabled) return true;
      return !!auth?.user;
    },
  },
});
