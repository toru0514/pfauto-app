import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ .env.local に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください"
  );
  process.exit(1);
}

const [, , email, password, name] = process.argv;

if (!email || !password) {
  console.log("使い方: pnpm tsx scripts/seed-admin.ts <email> <password> [name]");
  console.log("例:     pnpm tsx scripts/seed-admin.ts admin@example.com mypassword Admin");
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // 既存チェック
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    console.log(`⚠️  ${email} は既に登録されています。パスワードを更新します。`);
    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase
      .from("admin_users")
      .update({ password_hash: hash, name: name || "Admin" })
      .eq("email", email);

    if (error) {
      console.error("❌ 更新に失敗しました:", error.message);
      process.exit(1);
    }
    console.log("✅ パスワードを更新しました");
    return;
  }

  // 新規作成
  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from("admin_users").insert({
    email,
    password_hash: hash,
    name: name || "Admin",
  });

  if (error) {
    console.error("❌ 登録に失敗しました:", error.message);
    process.exit(1);
  }

  console.log(`✅ 管理者ユーザーを作成しました: ${email}`);
}

main();
