import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * サーバーサイドで Supabase Auth のセッションを検証するためのクライアント。
 * service_role_key を使い、auth.getUser() でアクセストークンを検証する。
 */
export async function getAuthUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) return null;

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) return null;
  return user;
}
