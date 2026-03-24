import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  );
}

/**
 * JWT の exp クレームを読み取り、期限切れかどうかを判定する。
 * 期限の5分前からリフレッシュ対象とする。
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp as number;
    // 5分前にリフレッシュ
    return Date.now() >= (exp - 300) * 1000;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  // トークンがなければログインへ
  if (!accessToken && !refreshToken) {
    return redirectToLogin(request, pathname);
  }

  // アクセストークンが有効ならそのまま通す
  if (accessToken && !isTokenExpired(accessToken)) {
    return NextResponse.next();
  }

  // アクセストークンが期限切れ or 不在 → リフレッシュ試行
  if (refreshToken) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      try {
        const supabase = createClient(url, anonKey, {
          auth: { persistSession: false },
        });

        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (!error && data.session) {
          const response = NextResponse.next();
          const maxAge = 60 * 60 * 24 * 30;
          response.cookies.set("sb-access-token", data.session.access_token, {
            path: "/",
            maxAge,
            sameSite: "lax",
          });
          response.cookies.set("sb-refresh-token", data.session.refresh_token, {
            path: "/",
            maxAge,
            sameSite: "lax",
          });
          return response;
        }
      } catch {
        // リフレッシュ失敗 → ログインへ
      }
    }
  }

  return redirectToLogin(request, pathname);
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
  const response = NextResponse.redirect(loginUrl);
  // 無効なトークンをクリア
  response.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
  response.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
