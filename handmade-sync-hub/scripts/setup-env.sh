#!/bin/bash

# Handmade Sync Hub 環境変数セットアップスクリプト
# 使用方法: ./scripts/setup-env.sh

set -e

echo "=== Handmade Sync Hub 環境変数セットアップ ==="
echo ""

# .env.localが存在するか確認
if [ -f .env.local ]; then
    read -p ".env.local が既に存在します。上書きしますか？ (y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "セットアップをキャンセルしました。"
        exit 0
    fi
fi

# 管理者メールアドレス
read -p "管理者メールアドレス: " admin_email
admin_email=${admin_email:-admin@example.com}

# 管理者パスワード
read -sp "管理者パスワード: " admin_password
echo ""

# パスワードハッシュを生成
echo "パスワードハッシュを生成中..."
admin_password_hash=$(node -e "console.log(require('bcryptjs').hashSync('$admin_password', 10))")

# NextAuth シークレットを生成
echo "NextAuth シークレットを生成中..."
nextauth_secret=$(openssl rand -base64 32)

# .env.local を作成
cat > .env.local << EOF
# 自動生成: $(date)

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# NextAuth 認証設定
ADMIN_EMAIL=$admin_email
ADMIN_PASSWORD_HASH=$admin_password_hash
NEXTAUTH_SECRET=$nextauth_secret

# Google Sheets 連携（本番で設定）
GOOGLE_SERVICE_ACCOUNT_BASE64=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_WORKSHEET_TITLE=シート1
USE_MOCK_SHEETS_DATA=true

# Playwright（開発時は空でOK）
PLAYWRIGHT_CREEMA_EMAIL=
PLAYWRIGHT_CREEMA_PASSWORD=
PLAYWRIGHT_MINNE_EMAIL=
PLAYWRIGHT_MINNE_PASSWORD=
PLAYWRIGHT_RUN_MINNE=false
PLAYWRIGHT_RUN_CREEMA=false
PLAYWRIGHT_BASE_EMAIL=
PLAYWRIGHT_BASE_PASSWORD=
PLAYWRIGHT_RUN_BASE=false
PLAYWRIGHT_IICHI_EMAIL=
PLAYWRIGHT_IICHI_PASSWORD=
PLAYWRIGHT_RUN_IICHI=false
CREEMA_BASE_URL=https://www.creema.jp
BASE_BASE_URL=https://admin.thebase.com

# Sentry（任意）
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Slack 通知（任意）
SLACK_WEBHOOK_URL=

# ログレベル
LOG_LEVEL=debug
EOF

echo ""
echo "=== セットアップ完了 ==="
echo ".env.local が作成されました。"
echo ""
echo "次のステップ:"
echo "1. npm install"
echo "2. npm run dev"
echo "3. ブラウザで http://localhost:3000/login にアクセス"
echo "4. 設定したメールアドレスとパスワードでログイン"
