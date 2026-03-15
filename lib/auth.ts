import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin";
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminEmail || !adminPasswordHash) {
          console.error("[auth] ADMIN_EMAIL or ADMIN_PASSWORD_HASH is not set");
          return null;
        }

        if (credentials.email !== adminEmail) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          adminPasswordHash
        );

        if (isValidPassword) {
          const adminUser: AdminUser = {
            id: "admin",
            email: adminEmail,
            name: "Admin",
            role: "admin",
          };
          return adminUser;
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour - refresh token every hour
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const role = (user as Partial<AdminUser>).role ?? "admin";
        token.role = role;
      }
      token.role = token.role ?? "admin";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? "admin";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
