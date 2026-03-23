import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseClient } from "@/adapters/supabase/client";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin";
};

/**
 * Supabase の admin_users テーブルから認証情報を取得する。
 * DB が利用不可の場合は null を返す。
 */
async function findAdminUserFromDb(
  email: string
): Promise<{ id: string; email: string; password_hash: string; name: string } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("admin_users")
      .select("id, email, password_hash, name")
      .eq("email", email)
      .single();

    if (error || !data) return null;
    return data as { id: string; email: string; password_hash: string; name: string };
  } catch {
    return null;
  }
}

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

        // 1. まず DB から認証情報を取得
        const dbUser = await findAdminUserFromDb(credentials.email);
        if (dbUser) {
          const isValid = await bcrypt.compare(
            credentials.password,
            dbUser.password_hash
          );
          if (isValid) {
            const adminUser: AdminUser = {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name || "Admin",
              role: "admin",
            };
            return adminUser;
          }
          // DB にユーザーが存在するがパスワードが一致しない → 認証失敗
          return null;
        }

        // 2. フォールバック: 環境変数から認証（DB未設定・移行期間用）
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
