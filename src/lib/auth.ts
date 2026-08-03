import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// ── 简单暴力破解防护：内存滑动窗口（单实例适用） ──
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; firstAt: number }>();

function loginAllowed(email: string): boolean {
  const rec = loginAttempts.get(email);
  if (!rec) return true;
  if (Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(email);
    return true;
  }
  return rec.count < LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(email: string) {
  const rec = loginAttempts.get(email);
  if (!rec || Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, firstAt: Date.now() });
  } else {
    rec.count++;
  }
}

function clearLoginAttempts(email: string) {
  loginAttempts.delete(email);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // 限流：同一邮箱 15 分钟内最多 5 次失败
        if (!loginAllowed(email)) {
          throw new Error("尝试次数过多，请 15 分钟后再试");
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          recordLoginFailure(email);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          recordLoginFailure(email);
          return null;
        }

        clearLoginAttempts(email);
        return {
          id: user.id,
          email: user.email,
          name: user.nickname,
        };
      },
    }),
  ],
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
