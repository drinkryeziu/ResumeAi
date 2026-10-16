import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { z } from "zod/v4";
import { getStore } from "@/server/store";
import { verifyPassword } from "./password";
import { onboardUser } from "./accounts";

/**
 * Auth.js (NextAuth v5).
 * - Email + password: Credentials provider, scrypt hashes in the user store.
 * - Google / LinkedIn: enabled automatically when their client id + secret are set.
 * Sessions are signed, httpOnly JWT cookies, so no session table is needed.
 */

const Login = z.object({ email: z.email(), password: z.string().min(1) });

export const oauthProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  linkedin: Boolean(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET),
};

if (!process.env.AUTH_SECRET && process.env.NODE_ENV !== "production") {
  // Dev convenience only. Production refuses to start without AUTH_SECRET.
  process.env.AUTH_SECRET = "applyai-dev-secret-change-me-please-0123456789";
}

const config: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = Login.safeParse(raw);
        if (!parsed.success) return null;
        const store = await getStore();
        const user = await store.findUserByEmail(parsed.data.email);
        if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(oauthProviders.google ? [Google] : []),
    ...(oauthProviders.linkedin ? [LinkedIn] : []),
  ],
  callbacks: {
    /** OAuth sign-in: find or create the app user for this email. */
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;
      if (!user.email) return false;
      const store = await getStore();
      const existing = await store.findUserByEmail(user.email);
      const appUser = existing ?? (await onboardUser(store, { email: user.email, name: user.name ?? user.email.split("@")[0]!, passwordHash: null }));
      user.id = appUser.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
