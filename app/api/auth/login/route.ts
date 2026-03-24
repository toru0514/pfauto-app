import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
