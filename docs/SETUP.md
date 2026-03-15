# Handmade Sync Hub セットアップガイド

## 必須環境変数

### 認証設定

```bash
# 管理者メールアドレス
ADMIN_EMAIL=admin@example.com

# パスワードハッシュの生成（以下のコマンドで生成）
# node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
ADMIN_PASSWORD_HASH=$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# NextAuth シークレット（以下のコマンドで生成）
# openssl rand -base64 32
NEXTAUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Google Sheets 連携

```bash
# サービスアカウントJSONをBase64エンコード
# cat service-account.json | base64 | tr -d '\n'
GOOGLE_SERVICE_ACCOUNT_BASE64=xxxxx

# スプレッドシートID（URLから取得）
# https://docs.google.com/spreadsheets/d/[このID]/edit
GOOGLE_SHEETS_SPREADSHEET_ID=xxxxx

# ワークシート名（デフォルト: シート1）
GOOGLE_SHEETS_WORKSHEET_TITLE=シート1

# 開発時にモックデータを使用する場合
USE_MOCK_SHEETS_DATA=false
```

### Sentry エラー監視（任意）

```bash
# Sentry DSN（プロジェクト設定から取得）
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Sentry 組織・プロジェクト名
SENTRY_ORG=your-org
SENTRY_PROJECT=handmade-sync-hub

# ソースマップアップロード用トークン
SENTRY_AUTH_TOKEN=sntrys_xxx
```

### Slack 通知（任意）

```bash
# Slack Incoming Webhook URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
```

### ログ設定

```bash
# ログレベル: debug, info, warn, error
LOG_LEVEL=info
```

## パスワードハッシュの生成方法

```bash
# プロジェクトディレクトリで実行
node -e "console.log(require('bcryptjs').hashSync('your-secure-password', 10))"

# 出力例: $2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBuBkFI...
```

## ローカル開発環境のセットアップ

1. `.env.local` ファイルを作成

```bash
cp .env.example .env.local
```

2. 必須環境変数を設定

3. 依存関係のインストール

```bash
npm install
```

4. 開発サーバーの起動

```bash
npm run dev
```

5. テストの実行

```bash
# ユニットテスト
npm run test:unit

# スモークテスト（モックデータ使用）
npm run test:smoke
```

## Vercel へのデプロイ

1. Vercel プロジェクトの環境変数に上記の値を設定

2. GitHub リポジトリと連携

3. main ブランチへのプッシュで自動デプロイ

## CI/CD パイプライン

GitHub Actions で以下が自動実行されます：

- ESLint チェック
- ユニットテスト
- TypeScript 型チェック
- ビルド確認
- スモークテスト

## トラブルシューティング

### 環境変数検証エラー

```
Missing required environment variables: NEXTAUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH
```

→ `.env.local` に必須環境変数が設定されているか確認してください。

### パスワードハッシュ形式エラー

```
ADMIN_PASSWORD_HASH does not appear to be a valid bcrypt hash
```

→ ハッシュが `$2a$` または `$2b$` で始まっているか確認してください。

### Google Sheets API エラー

→ サービスアカウントにスプレッドシートへの編集権限が付与されているか確認してください。
