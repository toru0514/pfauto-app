# Creema & Minne Automation App

このドキュメントは、本プロジェクトに関する方針・要件・設計指針のマスタとして管理します。更新時は必ず内容を確認し、このREADMEを基準に議論・作業を進めてください。

## プロジェクト概要
- **目的**: Creema・minneをはじめとしたハンドメイド作品販売プラットフォームへの出品作業を自動化し、スプレッドシートに蓄積した商品情報を元に各PFの下書き状態まで生成する。
- **ターゲットPF**: 初期対応はCreemaとminne。将来的にBASEなど他PFへ拡張可能なアーキテクチャを採用する。
- **利用技術**: フロントエンドはNext.js + Tailwind CSS + shadcn/ui、バックエンド/APIはNext.js内で構築。自動化処理にPlaywrightを利用し、Vercelへデプロイする。

## ユースケース
- 商品情報をスプレッドシートで一元管理し、対象PFに応じた下書きを自動生成。
- 投稿前の状態まで自動操作し、ユーザーが最終確認・微調整のうえ手動で公開する運用。
- 複数PFへの同時出品を効率化し、ヒューマンエラーを削減。

## 主要機能
- Google Sheetsからの商品データ取得・同期（差分検知、ステータス更新）。
- PFごとの入力項目マッピングとバリデーション。
- Playwrightによるログイン・フォーム入力処理の自動化（画像対応は後続検討）。
- 実行ステータスの可視化ダッシュボード（実行キュー、エラーログ、リトライ制御）。
- 新規PF追加や項目変更に対応しやすいアダプタ構造。

## スコープ
- **対象外**: 自動での最終投稿操作、PF側の承認・公開ワークフロー制御、在庫管理機能。
- **前提**: ユーザーはPFの利用規約・自動化に関する制約を順守し、必要に応じて2段階認証等の設定を行う。
- **スコープ外対応**: 大量投稿・大規模バッチ処理は現段階では考慮しない。

## アーキテクチャ方針
- **Next.js App Router** を前提とし、サーバーアクションやAPI Routesを組み合わせて実装。
- **shadcn/ui + Tailwind CSS** で管理画面を構築し、フォームやテーブルなど再利用性の高いUIコンポーネントを活用。
- **Playwright** はバックエンド側で操作し、ブラウザ自動操作ジョブはサーバーサイドでトリガー。
- データ保存は当面Next.jsのサーバー環境上（Vercel）で扱いやすいマネージドDB（Supabase/Postgres）もしくはVercel KVを検討。
- PFごとの実装は抽象化された`PlatformAdapter`インターフェースに従い、入力項目・操作フローを分離。

### Next.js プロジェクトセットアップ方針
- Next.js 14 (App Router) + TypeScript を前提とし、`experimental.appDir` を有効にしたサーバーコンポーネント中心の構成とする。Strict Mode と `typescript.strict: true` を初期設定で有効化する。
- パッケージマネージャーは `pnpm` を採用し、CI/CD でも `pnpm install --frozen-lockfile` を標準とする。依存追加時は `pnpm add` / `pnpm add -D` を利用する。
- ベースディレクトリ構造を下記とし、ヘキサゴナルアーキテクチャのレイヤを反映する。
  - `app/`: App Router と UI。inbound adapter（ユーザーインターフェース層）。
  - `components/`: UI プレゼンテーションコンポーネント（shadcn/ui のラップを含む）。
  - `core/`: ドメインモデル（エンティティ、値オブジェクト、ドメインサービス、ドメインイベント）。
  - `application/`: ユースケースやサービス。ドメインとポートを協調させ、トランザクション境界を定義。
  - `adapters/`: 外部システムとの接続。`adapters/outbound/*`（Google Sheets, Playwright など）と `adapters/inbound/*`（API Routes 等）で整理。
  - `lib/`: 汎用ユーティリティ（API クライアント、データ変換、ログなど）。
  - `tests/`: Playwright・ユニットテスト資産。
  - `config/`: tailwind、shadcn、eslint などの設定ファイル（必要に応じて）。
- Tailwind CSS + shadcn/ui を導入し、スタイルは Tailwind ユーティリティを基本とする。アイコンは `lucide-react` を利用し、フォームバリデーションは `zod` + `@hookform/resolvers` を採用する。
- Lint/Format は `eslint-config-next` に加えて `@typescript-eslint` の推奨設定を適用し、Prettier をフォーマッタに統一する。コミット前フックとして `lint-staged` + `husky` を導入し、`pnpm lint` / `pnpm test` が通ることを前提としたレビュー運用を行う。

### ヘキサゴナルアーキテクチャ指針
- ドメイン層（`core/`）を中心に、アプリケーション層とアダプタ層をポート経由で接続する。ユースケースはアプリケーション層に集約し、UI や外部サービスからの依存がドメインへ直接届かない構成とする。
- ポート定義は TypeScript のインターフェースで表し、`application/ports` などで管理する。アダプタはこれらのポートを実装したクラス/関数として `adapters/*` に配置。
- inbound adapters: Next.js App Router（ページ、API Routes、Server Actions）や Webhook など。アプリケーション層のユースケースを呼び出し、DTO 変換を担う。
- outbound adapters: Google Sheets、Playwright ジョブランナー、データベースなど。ドメイン/アプリケーション層からはポート経由で利用し、具体実装は `adapters/outbound/*` にまとめる。
- テスト方針はレイヤ単位に用意し、ドメイン層は純粋なユニットテスト、アプリケーション層はポートをモック化したサービステスト、アダプタ層は統合テスト（Playwright, API 経路）を実行する。

### PlatformAdapter インターフェース方針
- 役割: Sheets の `Product` レコードを PF 固有の入力仕様へマッピングし、Playwright 実行ジョブに渡すための正規化・バリデーションを担当する。
- 実装場所: `adapters/outbound/platforms/<pf>/adapter.ts`（例: `adapters/outbound/platforms/creema/adapter.ts`）。共通型やユーティリティは `application/ports/platforms` や `core/platform` 等で共有。

```ts
export interface PlatformAdapter {
  readonly platform: "creema" | "minne" | string;
  canProcess(product: ProductRecord): boolean; // available_platforms 等で対象判定
  normalize(product: ProductRecord): NormalizedProduct; // PF入力仕様に合わせた正規化
  validate(normalized: NormalizedProduct): ValidationResult; // 必須項目や文字数などを検証
  buildAutomationSteps(normalized: NormalizedProduct): AutomationStep[]; // Playwright 操作定義を生成
}
```

- `ProductRecord`: Sheets 1 行分のデータ。空欄列も保持する。
- `NormalizedProduct`: PF固有の DTO（例: `CreemaProductInput`）。カテゴリIDや在庫情報など、PFに即した形へ整理する。
- `AutomationStep`: Playwright ワーカーで解釈できる操作列挙。`{ type: "fill" | "select" | "upload" | ... }` などの統一フォーマットを採用。
- `ValidationResult`: `{ success: boolean; errors?: PlatformValidationError[] }` を想定。エラー時は理由（列名/項目、内容）を保持し、同期キューに `error` ステータスを反映する。
- エラー処理: `validate` で弾くべき内容（必須未入力、文字数超過、カテゴリID未設定等）は Adapter が検知し、Playwright 実行まで到達させない。DOM 変更やネットワーク障害など実行時エラーは Playwright 側でキャッチし、`last_error_message_<pf>` に記録する。
- テスト指針: 各 Adapter ごとにユニットテストを用意し、`normalize`/`validate`/`buildAutomationSteps` の変換ロジックを検証する。PF仕様変更時の regression を早期に検知する目的。

## 想定データモデル（初期案）
- `Product`: スプレッドシートと同期する商品情報。タイトル、説明、価格、タグ、画像参照先のメタ情報、PF別の出品ステータスを保持。
- `SubmissionJob`: 実行された自動投稿ジョブの履歴。対象PF、開始・終了時刻、結果、エラー内容など。
- `PlatformConfig`: PF固有の入力マッピング・必須項目・バリデーションルール。

### Google Sheets 項目定義（ドラフト）
Creema / minne 双方の要件を満たすために、シート上では両PFの項目を包含するスキーマを採用する。未対応PF向けの項目は空欄で構わず、どの列を参照するかはアダプタ側で判定する。

| 列名 | 型/フォーマット | 目的 | 備考 |
| --- | --- | --- | --- |
| `product_id` | string | 商品の一意キー。PF横断で同一商品を識別する | Google Sheets のキー列。既存IDがない場合は UUID 等で採番 |
| `sku` | string | 在庫管理向け SKU | 任意。空欄可 |
| `title` | string | 商品タイトル（共通） | PF共通の基本名称。PF専用タイトルが必要な場合は後述専用列を使用 |
| `subtitle` | string | 補足タイトル | Creema で入力欄あり。minne では任意 |
| `description` | long text | 商品説明（共通） | Markdown想定。PF固有テンプレート列で上書き可能 |
| `price` | number | 税込価格（円） | PFの最低価格要件を事前に満たすこと |
| `inventory` | number | 在庫数 | minne 必須、Creema 任意 |
| `material` | string | 素材・材料 | Creema 必須。複数素材はカンマ区切り |
| `size_notes` | string | サイズ/寸法 | cm表記を基本とし、自由記述可 |
| `weight_grams` | number | 重量（g） | 配送方法判定に利用 |
| `tags` | comma separated | キーワードタグ | PFごとの上限をバリデーション |
| `category_common` | string | 共通カテゴリラベル | 内部管理用。PFカテゴリIDの決定に利用 |
| `image_urls` | newline separated | 画像URLのリスト | 上から順にアップロード。最大枚数はPFで制御 |
| `variant_options` | JSON string | バリエーション構成 | minne のオプション入力に対応。Creemaは任意 |
| `production_lead_time_days` | number | 制作期間（日） | 両PFで指定可能 |
| `shipping_fee` | number | 送料（円） | minne 必須。Creema は配送プロファイル利用時に参照 |
| `shipping_method` | string | 配送方法 | プルダウン項目を想定。PF固有マッピングあり |
| `shipping_origin_pref` | string | 発送元都道府県 | 両PF必須 |
| `available_platforms` | string | 出品対象PF (`creema|minne|both`) | 対象PFフィルタに利用 |
| `notes_internal` | string | 運用メモ | 自動化ロジックは参照しない |

#### PF固有列
- `creema_category_id`, `creema_shipping_profile_id`, `creema_handling_time_days`, `creema_shop_section`: Creema 専用列。未設定の場合は PlatformAdapter が既定値を適用するかエラーにする。
- `minne_category_id`, `minne_shipping_method_id`, `minne_shipping_fee_code`, `minne_required_options`: minne 専用列。空欄の場合は同期対象から除外するか、バリデーションで警告を返す。
- PF固有列は `<pf>_<domain>_<name>` 命名を基本とし、追加PFにも拡張しやすいよう運用する。

#### ステータス列と遷移
- `sync_status`: 全体の同期状態。`new` → `ready` → `queued` → `processing` → `drafted` を基本とし、`error` / `skipped` で終了できる。
- `creema_status`, `minne_status`: PFごとの個別状態。共通語彙（`ready`, `queued`, `processing`, `drafted`, `error`）を使用して履歴を記録する。
- `last_synced_at_<pf>`: 最終同期時刻。Playwright 実行後に更新する。
- `last_error_message_<pf>`: 直近のエラー要約。`error` 状態時のみ値を保持し、解消後は空欄に戻す。
- 手動リカバリを行う場合は `sync_status` を `ready` に戻し、自動化キューが再処理できるようにする。

## 外部連携
- **Google Sheets API**: 認証はService Accountを利用し、指定スプレッドシートの読み書きを行う。
- **画像ストレージ**: 初期フェーズではローカルもしくは既存の管理フローを前提にし、後続でmicroCMS等を検討。
- **認証情報管理**: Vercelの環境変数およびSecret Managementを活用。Playwrightで必要なCookieやトークンの扱いは暗号化ストレージで管理する方針。

## セキュリティ・運用上の考慮
- PFの利用規約に抵触しない範囲での自動化設計（アップロード操作を行わない範囲で、自身のアカウント内の操作やスクレイピングは問題ないことを確認済み）。
- 2段階認証やCAPTCHA発生時の手動介入手段を提供。
- ログイン情報・APIキーはGit管理から除外し、ローテーション可能な仕組みを用意。
- ジョブ失敗時のリトライ制御と通知（メール/Slackなど）を検討。

### 認証・シークレット管理ポリシー
- 環境変数は Vercel の Environment Variables で `production`/`preview`/`development` を分けて管理し、値の追加・更新は Pull Request 承認後に担当者が反映する。必要に応じて `vercel env pull` でローカルへ同期する。
- Google Sheets 連携に使用する Service Account キーは暗号化ストレージで保管し、Vercel には JSON を Base64 化した値を登録してアプリ起動時に復号する。ローカルでは `.env.local` にのみ配置し、共有は行わない。
- Playwright で利用する PF ログイン資格情報や 2FA シークレットは Vercel Secret Management で扱い、ステージング用と本番用を明確に分離する。一次パスコードが必要な場合はワンタイムで利用できる専用メールボックスや OTP 管理ツールを用意する。
- ローカル開発者は `.env.local` に必要なキーを設定し、`.env.example` でダミー値と説明を共有する。`.env*` ファイルが `.gitignore` に含まれていることを定期的に確認する。
- 秘匿情報のローテーション方針を README に記録し、少なくとも四半期ごとに見直す。漏洩が疑われる場合は直ちに Vercel から該当キーを無効化し、新しい値に切り替えて通知する。

#### `.env.example` の整備
- プロジェクトルートに `.env.example` を作成し、必要なキーと目的をコメントで明示する。
- 実際の値を含めず、`<placeholder>` やダミー値で構成し、各項目の入力元（Vercel、Google Cloud など）を併記する。
- 新しい環境変数を追加した際は Pull Request で `.env.example` と README 双方を更新する。

```bash
# API エンドポイント
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Sheets 連携
GOOGLE_SERVICE_ACCOUNT_BASE64=<Base64-encoded JSON>
GOOGLE_SHEETS_SPREADSHEET_ID=<Spreadsheet ID>

# Playwright 自動化用資格情報
PLAYWRIGHT_CREEMA_EMAIL=<creema@example.com>
PLAYWRIGHT_CREEMA_PASSWORD=<password>
PLAYWRIGHT_MINNE_EMAIL=<minne@example.com>
PLAYWRIGHT_MINNE_PASSWORD=<password>

# セッション管理・通知
SESSION_SECRET=<random string>
SLACK_WEBHOOK_URL=<https://hooks.slack.com/...>
```

#### シークレットローテーション手順
- 定期ローテーションは四半期ごとに実施し、Google Service Account キー、PF ログイン資格情報、各種 API キーを対象とする。
- ローテーション担当者は新しい値を発行し、Vercel の対象環境に反映 → デプロイを再実行して動作確認 → チームに完了を通知する。
- ローカル開発環境では影響を受けるメンバーに新しい値の取得方法を案内し、`.env.local` を更新後に `next dev` 起動確認を行う。
- 漏洩インシデントが疑われる場合は、該当キーを即時無効化し、事後レポートに原因と影響範囲を記録する。

## 開発ロードマップ（ドラフト）
1. 要件すり合わせ & スプレッドシート項目定義
2. Next.jsプロジェクトセットアップ（Tailwind、shadcn/ui導入、認証/環境変数のベース整備）
3. Google Sheets API連携PoC（読み込み・ステータス更新）
4. PlaywrightでのCreemaログイン・フォーム自動入力PoC
5. minne対応、フォーム入力モジュール共通化
6. UIダッシュボード構築（商品一覧、ジョブ履歴、実行トリガー）
7. エラー処理・リトライ・通知フロー実装
8. BASEなど追加PFの検討とアダプタ設計見直し

## Playwright自動入力に向けた準備事項
- **検証環境**: Creema / minne のテスト用アカウント（本番と同等のフローが確認できるもの）。
- **ログイン情報管理**: メールアドレス・パスワード、2段階認証コード取得手段（Authenticator／メールなど）。
- **ターゲットページの調査**: ログインページ、商品登録フォーム、下書き保存ページのURLと遷移フロー。
- **フォーム項目一覧**: 各PFで必須・任意の入力フィールド、文字数制限、選択肢の有無、画像仕様。
- **DOMセレクタ設計**: 安定したCSSセレクタ／テストIDの抽出。変更が頻繁な要素はラッパー関数で抽象化。
- **ステップ定義**: ログイン、商品情報入力、画像仮アップロード、下書き保存直前までの操作シーケンス。
- **エラー検出ポイント**: バリデーションエラー表示、タイムアウト、CAPTCHA などの分岐処理把握。
- **手動介入手段**: ヘッドフル実行で途中停止できるデバッグモード、失敗時のスクリーンショット保存。

## テスト・検証方針
- PlaywrightテストでPFフォーム操作のスモークテストを定期実行。
- Next.js APIはユニットテスト（Jest/Testing Library）とエンドツーエンドテストを組み合わせる。
- スプレッドシート同期処理のモックテストやステージング環境での結合確認を実施。

## デプロイ・環境
- **ホスティング**: Vercel（Production / Preview環境を活用）。
- **CI/CD**: GitHub連携による自動デプロイ、PlaywrightテストのCI実行。
- **環境変数管理**: VercelのEnvironment VariablesとSecret Storeを使用。

## 今後の検討事項
- 画像管理フローの再整理（microCMS導入タイミング、サイズ圧縮、カテゴリ整理など）。
- 手動介入を支援するUI改善（差分比較、プレビュー画面、チェックリスト）。
- 法令対応（特商法、個人情報保護）やコンプライアンス確認プロセス。

---
このREADMEが常に最新の仕様・方針を反映するよう、変更時は内容をレビューしてから反映してください。
