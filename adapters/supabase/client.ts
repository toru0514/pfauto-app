import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getLogger } from "@/lib/logger";

const log = getLogger("supabase-client");

let cachedClient: SupabaseClient | null = null;

/**
 * Supabase クライアントを取得する。
 * 環境変数が未設定の場合は null を返す（Supabase 未導入環境でも動作可能）。
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    log.warn(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定のため、Supabase は無効です"
    );
    return null;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

/**
 * Supabase が利用可能かどうかを返す。
 */
export function isSupabaseEnabled(): boolean {
  return getSupabaseClient() !== null;
}
