import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * リフレッシュトークンを使ってアクセストークンを更新する。
 * middleware から呼ばれる。
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    const response = NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    response.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
    response.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });
    return response;
  }

  const response = NextResponse.json({ ok: true });
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  response.cookies.set("sb-access-token", data.session.access_token, {
    path: "/",
    maxAge,
    sameSite: "lax",
    httpOnly: true,
  });
  response.cookies.set("sb-refresh-token", data.session.refresh_token, {
    path: "/",
    maxAge,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
