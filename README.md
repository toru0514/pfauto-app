# Creema & Minne Automation App

このドキュメントは、本プロジェクトに関する方針・要件・設計指針のマスタとして管理します。更新時は必ず内容を確認し、このREADMEを基準に議論・作業を進めてください。

## プロジェクト概要
- **目的**: Creema・minneをはじめとしたハンドメイド作品販売プラットフォームへの出品作業を自動化し、スプレッドシートに蓄積した商品情報を元に各PFの下書き状態まで生成する。
- **ターゲットPF**: 初期対応はCreemaとminne。将来的にBASEなど他PFへ拡張可能なアーキテクチャを採用する。
- **利用技術**: フロントエンドはNext.js + Tailwind CSS + shadcn/ui、バックエンド/APIはNext.js内で構築。自動化処理にPlaywrightを利用し、Vercelへデプロイする。

## ユースケース
- 作業者がスプレッドシートで商品情報と出品先を入力し、管理画面の送信ボタンから対象商品の自動下書き作成を依頼できる。
- 自動化は下書き保存直前までを担い、作業者が最終チェックと公開操作を手動で行うことでプラットフォーム規約を順守する。
- Creema / minne を横断した出品作業を一元管理し、重複入力や入力漏れなどのヒューマンエラーを削減する。

### 作業者フロー（想定運用）
1. **スプレッドシート入力**: 商品名、説明、価格、カテゴリ、画像URLなどを README の項目定義に従って入力する。Creema/minne 固有の列が必要な場合は同時に埋める。
2. **下書き準備ステータス設定**: 出品したいプラットフォーム（Creema / minne / 両方）をシートの「出品先」列に記入し、ステータス列を「下書き準備済み」に更新する（初回登録時は自動的に「新規」から「下書き準備済み」へ切り替わる想定）。
3. **管理画面で送信**: アプリの「最新データを同期」操作で対象商品を読み込み、内容を確認したうえで送信ボタンを押す。送信と同時に処理キューへ登録される。
4. **進捗モニタリング**: ダッシュボードで「待機中」「処理中」「下書き作成済み」などの進捗を確認し、必要に応じてエラーログや画面内トースト通知をチェックする。
5. **下書き確認**: Creema/minne の管理画面にアクセスし、生成された下書きを確認・微調整して手動で公開する。問題があればステータスを再び「下書き準備済み」に戻し、再実行ボタンでリトライする。
6. **完了アーカイブ**: 公開済みの商品はシート上のステータスを「公開済み」などに更新し、以後の自動化対象から除外する。

### UI 画面構成（ドラフト）
1. **ダッシュボード（商品一覧）**
   - シートと同期した商品の一覧を表示。列: 商品名、出品先、現在ステータス、最終同期日時、最新エラーメモ。
   - アクション: 「最新データを同期」ボタン（Sheets→アプリ再読込）、「送信」ボタン（選択商品の自動アップロード）、詳細モーダル表示、エラーメモクリア、ステータスの手動変更。
   - フィルター/ソート: プラットフォーム別、ステータス別、更新日時順。
   - トースト通知: 送信成功/失敗時に結果を表示。

   | 列 ID | 表示名 | 内容 | 備考 |
   | --- | --- | --- | --- |
   | title | 商品名 | Sheets の `title` | クリックで詳細モーダルを開く |
   | platforms | 出品先 | Creema / minne のバッジ表示 | 複数の場合は複数バッジ |
   | status | ステータス | 「下書き準備済み」「待機中」など | アイコン/色で状態を可視化 |
   | lastSyncedAt | 最終同期 | 最終同期日時 | 未同期時は `-` |
   | lastError | 最新エラー | エラーメモの冒頭 50 文字 | 全文表示用のツールチップやモーダル |
   | actions | 操作 | 「送信」「詳細」「ステータス変更」ボタン | 送信時に対象PF選択ダイアログを表示 |

2. **商品詳細モーダル**
   - 商品情報の概要と、Creema / minne 各プラットフォーム向けの入力値を確認。
   - ジョブ履歴タブ: 過去の実行履歴、ステータス推移、スクリーンショットリンクを表示。
   - 操作ボタン: 「再送信」「ステータスを下書き準備済みに戻す」「エラーメモを記録」など。

   **タブ構成**
   - 概要: 共通情報（タイトル、価格、在庫、タグ、出品先、ステータス、最終同期日時、エラーメモ）。
   - Creema: Creema 向けフィールド（カテゴリID、素材、サイズ、配送設定など）。
   - minne: minne 向けフィールド（カテゴリID、発送方法、送料、オプションなど）。
   - ジョブ履歴: 過去の実行履歴（開始時刻、結果、所要時間、スクリーンショットリンク、ログURL）。

   **主要コンポーネント**
   - `Tabs` + `TabContent`
   - `KeyValueList`（概要表示）
   - `JobHistoryTable`
   - ボタン群（再送信、ステータスリセット、エラーメモ保存）

3. **ジョブステータスビュー**
   - 現在キューに積まれているジョブと進行中ジョブをタイムラインで表示。
   - 各ジョブの開始時刻、対象プラットフォーム、処理結果（成功/失敗）、リトライ回数を一覧化。
   - フィルターで特定商品のジョブのみを追跡できるようにする。

   | 列 ID | 表示名 | 内容 |
   | --- | --- | --- |
   | jobId | ジョブID | 内部ID（短縮表示） |
   | product | 商品名 | 商品タイトル + プラットフォームバッジ |
   | status | 進捗 | 「待機中」「処理中」「成功」「失敗」など |
   | attempt | 試行回数 | 現在のリトライ数 / 設定上限 |
   | startedAt | 開始時刻 | ローカライズされた日時 |
   | duration | 所要時間 | 完了時のみ表示 |

4. **設定 / 連携画面**（後続）
   - Google Sheets 連携のスプレッドシートID登録、Service Account キーアップロード。
   - 通知設定（トースト、将来的な Slack / メール）や Playwright 実行のデフォルト設定（並列数、タイムアウト）を管理。

各画面は shadcn/ui をベースに、一覧は `DataTable` コンポーネント、モーダルは `Dialog`、操作ボタンは `Button` を想定。フォーム入力やステータス更新は `react-hook-form` + `zod` でバリデーションを行う。

#### トースト通知の想定
| イベント | メッセージ例 | 備考 |
| --- | --- | --- |
| 送信開始 | `「春色ブーケピアス」の送信を開始しました` | 情報レベル。複数件送信時は件数を含める |
| 送信成功 | `Creema 下書き作成が完了しました` | 成功レベル。詳細モーダルへのリンクを表示 |
| 送信失敗 | `minne でエラーが発生しました: カテゴリが未設定です` | エラーレベル。再送信ボタンをトースト内に配置 |
| ステータス更新 | `ステータスを「下書き準備済み」に戻しました` | 成功レベル |
| エラーメモ保存 | `エラーメモを更新しました` | 成功レベル |

### 認証・アクセス制御（ダッシュボード）
- NextAuth.js + Credentials Provider を利用し、`.env.local` / Vercel Secrets に設定した単一の管理者メールアドレス・パスワードで認証する。
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD` を環境変数に定義し、アカウント追加は想定しない。
- ロールは `admin` のみ。ログインしたユーザーだけが一覧閲覧・送信・再送信・ステータス更新などすべての操作を行える。
- 未ログイン時は `/login` ページへリダイレクトし、ダッシュボードコンテンツは表示しない。
- パスワードリセット機能は提供せず、環境変数の更新 + 再デプロイで対応。
- セッション有効期限はブラウザのセッションに任せ、特別な期限を設けない。
- アクセス制御は App Router の `middleware.ts` で実装し、未認証リクエストは `/login` へ強制誘導。
- Server Action / API Route はセッション確認後にユースケースを呼び出す。認証エラー時は 401 を返し、ログインページへ誘導。
- 送信・再送信実行時には操作ログ（ユーザーID、操作内容、対象商品、タイムスタンプ）を `SubmissionJob` と同時に記録し、30 日以上保持する。

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

### アプリケーション層ポート・ユースケース
`application/ports` ではユースケースが外部とやり取りするインターフェースを定義し、実装はアダプタ層に委ねる。

- `ProductRepositoryPort`
  - `listReadyProducts()` : 「下書き準備済み」等の状態の商品データを取得。
  - `updateProductStatus(productId, status, options)` : ステータスやエラーメモを更新。
  - `recordSyncMetadata(productId, metadata)` : 同期時刻や担当PFなどを記録。
- `PlatformAutomationPort`
  - `enqueue(productId, platform)` : プラットフォームごとの自動化ジョブをキューに投入。
  - `markJobResult(jobId, result)` : ジョブ成功/失敗・ログURL等を保存。
- `NotificationPort`
  - `notify(target, payload)` : 管理画面のトースト通知を表示（将来的に Slack / メールへ拡張可能）。
- `MetricsPort`
  - `increment(metric, tags)` : 実行回数やエラー数を記録。
- `FileStoragePort`
  - `uploadScreenshot(jobId, buffer)` : Playwright 実行時のスクリーンショット保存。

#### API / Server Action のエンドポイント構成（案）

| Path | Method / 種別 | 認証 | 呼び出すユースケース | 主な I/O |
| --- | --- | --- | --- | --- |
| `/api/sync` | POST（Server Action） | ログイン済みユーザー | `SyncProductsUseCase` | リクエストなし／レスポンス: 処理件数、エラー概要 |
| `/api/automation/enqueue` | POST（Server Action） | ログイン済みユーザー | `PlatformAutomationPort.enqueue` 経由で `SyncProductsUseCase` | 入力: `productId`, `platforms[]` |
| `/api/automation/retry` | POST | ログイン済みユーザー | `RetryFailedJobUseCase` | 入力: `productId`, `platform` |
| `/api/automation/status` | GET | ログイン済みユーザー | `RefreshDraftStatusUseCase` | 出力: ジョブリスト（`jobId`, `status`, `attempt`, `timestamps`）|
| `/api/products/[id]` | GET | ログイン済みユーザー | `ProductRepositoryPort` | 出力: 商品詳細、ステータス、エラーメモ、ジョブ履歴 |
| `/api/products/[id]/status` | PATCH（Server Action） | ログイン済みユーザー | `ProductRepositoryPort.updateProductStatus` | 入力: `status`, `errorMessage?` |

- フロントエンドからは Server Action を優先して利用し、App Router のフォーム送信やボタン押下で直接ユースケースを呼び出す。
- API Route は非同期処理（Playwright ジョブ）からのコールバックや、外部連携用のエンドポイントとして利用。必要に応じて Next.js Route Handler でレスポンスキャッシュや認証ミドルウェアを挟む。
- 認証は NextAuth などで実装し、管理者ロールのみが送信/再同期操作を行えるようにする。

主要ユースケース（`application/usecases` 想定）
- `SyncProductsUseCase`
  - inbound: App Router からの実行/スケジューラ。
  - ports: `ProductRepositoryPort`, `PlatformAutomationPort`, `NotificationPort`。
  - 手順: Sheets から差分取得→ステータス更新→バリデーション→ジョブキュー投入→結果を管理画面トーストで通知。
- `RefreshDraftStatusUseCase`
  - inbound: 手動トリガーや定期バッチ。
  - ports: `ProductRepositoryPort`, `PlatformAutomationPort`。
  - 手順: ジョブ結果を確認し、ステータス/メタデータを更新。
- `RetryFailedJobUseCase`
  - inbound: 作業者の再実行操作。
  - ports: `ProductRepositoryPort`, `PlatformAutomationPort`, `NotificationPort`。
  - 手順: エラー商品の内容を再チェック→再キュー投入→トースト通知。
- `LogAutomationResultUseCase`
  - inbound: ジョブランナーからのコールバック/完了イベント。
  - ports: `PlatformAutomationPort`, `ProductRepositoryPort`, `MetricsPort`, `FileStoragePort`。
  - 手順: 実行結果/スクリーンショット保存→商品のステータス更新→メトリクス記録。

各ユースケースはドメインサービスを組み合わせ、アダプタ層を直接参照せずに完結する構造を保つ。

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

### ユースケース実行フロー（同期〜自動化）
1. **商品データ同期（Google Sheets）**: inbound adapter（UI/Server Action）が `application` 層の同期ユースケースを呼び出し、スプレッドシートから「下書き準備済み」の商品行を取得する（内部的には `sync_status = ready` 等に対応）。差分検知で新規・更新・削除を判定し、必要に応じて状態を更新。
2. **バリデーション & 正規化**: `application` 層で対象プラットフォームの PlatformAdapter を解決し、`canProcess` → `normalize` → `validate` を順に実行。バリデーションで問題が見つかった場合はエラー内容を記録し、シート上のステータスを「エラー」に戻す（内部的には `sync_status = error`）。
3. **Playwright 実行キュー投入**: 合格した商品のみキューへ登録し、ジョブランナー（outbound adapter）が Playwright セッションを開始。`buildAutomationSteps` の出力に従い、ログイン〜フォーム入力〜下書き保存直前まで自動操作する。処理中は「待機中」→「処理中」と状態を遷移させる。
4. **ステータス更新 & ログ出力**: 実行結果に応じて「下書き作成済み」または「エラー」に設定し、タイムスタンプやスクリーンショット、ログを `SubmissionJob` に紐付けて保存。画面内トースト通知で結果を共有し、必要に応じて将来的に Slack / メールへ拡張する。
5. **リトライ・再同期**: 作業者がシート上で内容を修正した場合はステータスを再び「下書き準備済み」に更新し、1 の同期ユースケースで再取り込みする。自動リトライの回数・間隔はアプリケーション層で制御し、閾値を超えた場合は「処理対象外」（内部的には `skipped`）に移行する。

### Playwright ジョブ実行仕様
- **キュー方式**: FIFO のジョブキューを採用。`PlatformAutomationPort.enqueue` で登録し、ジョブワーカー（Node.js プロセス）が順次処理する。
- **並列数**: デフォルト 1 並列。将来的にプラットフォーム別の同時実行数を設定できるようにする（例: Creema 1、本番で増やす場合は環境変数で制御）。
- **タイムアウト**: 1 ジョブあたり最大 5 分（`PLAYWRIGHT_JOB_TIMEOUT_MS` で設定）。ページ遷移やフォーム送信など重要ステップには個別のタイムアウト（30〜60 秒）も設定し、タイムアウト時はジョブを失敗扱いにする。
- **リトライ**: 最大 2 回まで自動リトライ。初回失敗 → 直後リトライ、2 回目失敗 → `error` ステータスとして停止。リトライ間隔は指数バックオフ（例: 1 分 → 3 分）を想定。
- **実行モード**: ヘッドレスを基本とし、デバッグ時はヘッドフルモード＋ステップ保存を可能にする（`PLAYWRIGHT_HEADLESS=false` で切り替え）。
- **ログ・スクリーンショット**: 各ステップでログを `SubmissionJob` に紐付け、失敗時はスクリーンショットと HTML ダンプを `FileStoragePort` 経由で保存（Vercel Blob / Supabase Storage 等）。成功時は必要に応じて最小限のログのみ保存。
- **通知**: 成功・失敗結果は `NotificationPort` を通じてトースト通知。複数ジョブ送信時はまとめて件数表示し、失敗ジョブには再送信ショートカットを付与。
- **クリーンアップ**: 実行後にブラウザインスタンスを確実に閉じ、セッション・Cookie を破棄。必要に応じて Playwright の `context.storageState` を用いてログイン状態をキャッシュし、期限切れ時のみ再ログインする。
- **監視指標**: `MetricsPort` でジョブ成功数、失敗数、平均処理時間、タイムアウト発生数などを記録。Dashbord で日次集計を表示することを検討。

## データ保持方針
- 当面は Google スプレッドシートをマスターデータとして利用し、アプリは同期・送信・進捗管理を担う。
- `Product` や `SubmissionJob` の情報もスプレッドシートとログ（Playwright 実行結果）で管理し、専用データベースは導入しない。
- 将来的に検索パフォーマンスやバックアップ用途で必要になった場合にのみ、Postgres / Supabase などの永続化スキーマを別途検討する。

### Google Sheets 項目定義（ドラフト）
Creema / minne 双方の要件を満たすために、シート上では両PFの項目を包含するスキーマを採用する。未対応PF向けの項目は空欄で構わず、どの列を参照するかはアダプタ側で判定する。

| 列名 | 型/フォーマット | 目的 | 備考 |
| --- | --- | --- | --- |
| `product_id` | string | 商品の一意キー。PF横断で同一商品を識別する | Google Sheets のキー列。既存IDがない場合は UUID 等で採番 |
| `sku` | string | 在庫管理向け SKU | 任意。空欄可 |
| `title` | string | 商品タイトル（共通） | PF共通の基本名称 |
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

#### スプレッドシートテンプレート（例）
```text
product_id | sku | title | description | price | inventory | material | size_notes | weight_grams | tags | category_common | image_urls | variant_options | production_lead_time_days | shipping_fee | shipping_method | shipping_origin_pref | 出品先 | ステータス | creema_category_id | minne_category_id | notes_internal
abc-001    | A-01| 春色ブーケピアス | 300字以内で商品説明を記載 | 3500 | 5 | 真鍮, ガラス | 全長約3cm | 10 | ピアス, 春 | アクセサリー/ピアス | https://example.com/images/abc-001-1.jpg\nhttps://example.com/images/abc-001-2.jpg | [{"option":"カラー","values":["ピンク","ブルー"]}] | 7 | 250 | ゆうパケット | 東京都 | creema,minne | 下書き準備済み | 123456 | 7890 | ラッピング可。母の日特集予定
```

#### 入力ルール
- **必須項目**: 商品タイトル、説明、価格、共通カテゴリ、発送元都道府県、出品先（Creema / minne / 両方）、ステータス。
- **文字数ガイド**: タイトルは 40 文字以内、説明は 3000 文字以内を目安とする。プラットフォームの実際の制限を超えないよう注意。
- **画像URL**: 1 行につき 1 URL を記入し、先頭から順にアップロードする。HTTPS の JPEG/PNG を推奨し、最大 5 枚程度を想定。
- **価格・在庫**: 価格は税込整数（円）で入力。在庫は minne の要件に合わせて 1 以上の整数を推奨。
- **タグ**: カンマ区切りで最大 10 件、各タグは 20 文字以内を目安とする。
- **ステータス列**: 「新規」→「下書き準備済み」→「待機中」→「処理中」→「下書き作成済み」→「公開済み」の遷移を想定。リトライ時は「下書き準備済み」に戻す。
- **PF固有列**: Creema のカテゴリID、minne の発送方法ID など必須項目は空欄にしない。未入力の場合は自動化対象外（スキップ）またはエラーとして戻される。

#### ステータス列と遷移
- `sync_status`: 全体の同期状態。`new` → `ready` → `queued` → `processing` → `drafted` を基本とし、`error` / `skipped` で終了できる。
- `creema_status`, `minne_status`: PFごとの個別状態。共通語彙（`ready`, `queued`, `processing`, `drafted`, `error`）を使用して履歴を記録する。
- `last_synced_at_<pf>`: 最終同期時刻。Playwright 実行後に更新する。
- `last_error_message_<pf>`: 直近のエラー要約。`error` 状態時のみ値を保持し、解消後は空欄に戻す。
- 手動リカバリを行う場合は `sync_status` を `ready` に戻し、自動化キューが再処理できるようにする。

#### 状態遷移（テキスト図）

```
sync_status (全体)
  new → ready → queued → processing → drafted → (公開済み: 手動更新)
                   ↘ error ↘ skipped ↘ ready (手動リトライ)

creema_status / minne_status (PF別)
  ready → queued → processing → drafted
                     ↘ error ↘ ready (手動 or 自動リトライ)

主なトリガー
- new: シートに追加された直後。
- ready: シート側で「下書き準備済み」に設定。SyncProductsUseCase が検知し、`listReadyProducts` で取得。
- queued: 送信ボタン押下でキュー投入。PF別にも `queued` を設定。
- processing: Playwright ジョブ開始時に設定。
- drafted: Playwright 成功時。`last_synced_at_<pf>` を更新。
- error: バリデーション失敗または Playwright 失敗時。`last_error_message_<pf>` に詳細を記録。
- skipped: 必須項目不足などで実行対象外とした場合。
- ready への手動戻し: UI の「ステータスを下書き準備済みに戻す」で実行。再同期すると再び `queued` 以降へ進む。

備考
- `sync_status` が `drafted` の場合でも PF 別ステータスが `drafted` になっていない場合は部分的な成功として扱い、残りの PF のみ再送信可能。
- 送信前に `queued` のまま一定時間経過した場合は `sync_status = error`、`last_error_message` にタイムアウト理由を記録。
- 公開後はシートのステータスを「公開済み」に更新し、自動化対象から除外。
```

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

# Dashboard Admin Credentials
ADMIN_EMAIL=<admin@example.com>
ADMIN_PASSWORD=<strong password>
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
- **初期セットアップ**
  - Playwright のインストール: `pnpm dlx playwright install --with-deps`
  - 初回実行で必要なブラウザバイナリ（Chromium）を取得。
  - `.env.local` に PF ログイン情報・2FA 設定・タイムアウト値などを記入し、`PLAYWRIGHT_` プレフィックスで管理。
  - Service Account など認証ファイルは `GOOGLE_SERVICE_ACCOUNT_BASE64` から展開し、ローカルでは `playwright/.auth` ディレクトリに配置（Git 管理外）。
  - Playwright Codegen で初回操作の録画を行い、フォーム入力手順を確認。
- **定期メンテナンス**
  - ブラウザバージョン更新（`pnpm dlx playwright install`）。最低でも四半期に一度、CI でも同期。
  - ログインセッション更新: PF 側でパスワード変更時は `playwright/.auth` の storage state を再生成。
  - 2FA デバイスの確認: Authenticator アプリやバックアップコードをテストし、期限切れがないか点検。
  - Vercel の環境変数/Secrets に保存している資格情報のローテーション。
  - Playwright Test のスモークテストを定期実行し、DOM 変更によるセレクタ崩れを早期検知。
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

### CI/CD & テスト運用フロー
- **ブランチ戦略**: `main` を本番ブランチとし、機能開発は `feature/*` ブランチで行う。PR を作成し、レビュー後に `main` へマージ。
- **Pull Request チェック**:
  - `pnpm lint`
  - `pnpm test`（必要に応じてユニットテスト）
  - `pnpm exec playwright test --config playwright.config.ci.ts` （短いスモークテスト）
- **CI 実行環境**: GitHub Actions を利用し、`pnpm install --frozen-lockfile` → `pnpm build` → テストの順で実行。
- **Playwright テスト**: CI ではヘッドレス + 最小ケースのみ実行。フルシナリオはローカル/ステージングで手動実行。
- **デプロイフロー**:
  - `main` へのマージで Vercel の Production に自動デプロイ。
  - PR 作成時は Preview デプロイを生成し、動作確認を行う。
- **ロールアウト**: デプロイ完了後、ダッシュボードでテスト商品を使った送信スモークテストを行い、通知・ステータス更新が正常に動作するか確認。
- **ロールバック**: 問題発生時は Vercel の Rollback 機能で前バージョンに切り戻し、修正後に再デプロイ。

#### 開発フロー（初心者向け）
1. リポジトリをクローン: `git clone ...` → `pnpm install` → `.env.local` を `.env.example` からコピーし、必要な環境変数（特に `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PLAYWRIGHT_*`）を設定。
2. Playwright の初回セットアップ: `pnpm dlx playwright install --with-deps` → `pnpm exec playwright install-deps`（必要な場合）。
3. 新しいブランチを作成: `git switch -c feature/<my-task>`。
4. ローカルで開発: `pnpm dev` で起動し、ダッシュボードにアクセス（`/login` → 管理者アカウントでログイン）。必要に応じて `pnpm lint`, `pnpm test`, `pnpm exec playwright test` を実行。
5. 作業内容をコミット: `git add`, `git commit`。小さな粒度でコミットし、メッセージを明確に。
6. リモートへブランチを push: `git push origin feature/<my-task>`。
7. GitHub で Pull Request を作成し、CI が通っていることを確認した上でレビューを依頼。
8. レビュー指摘を反映後、Approve を得て `main` へマージ。自動で Vercel Production にデプロイ。
9. 本番のダッシュボードでテスト商品を使ったスモークテストを行い、問題なければタスク完了。必要に応じて Issue やタスク管理ツールを更新。

## 今後の検討事項
- 画像管理フローの再整理（microCMS導入タイミング、サイズ圧縮、カテゴリ整理など）。
- 手動介入を支援するUI改善（差分比較、プレビュー画面、チェックリスト）。
- 法令対応（特商法、個人情報保護）やコンプライアンス確認プロセス。

## 開発〜運用移行チェックリスト
- [x] GitHub リポジトリを作成し、`.gitignore` に `.env*` や `playwright/.auth` を追加する。
- [ ] README（本ドキュメント）を `main` ブランチに反映し、`feature/*` ブランチ運用を開始する。
- [x] `pnpm create next-app`（App Router / TypeScript）でプロジェクトを生成する。
- [x] Tailwind CSS・shadcn/ui・lucide-react を導入し、共通スタイルを整備する。
- [x] `pnpm dlx shadcn-ui init` などで UI コンポーネント生成基盤を整える。
- [x] NextAuth.js（Credentials Provider）を導入し、`.env.local` に `ADMIN_EMAIL` / `ADMIN_PASSWORD` を設定する。
- [ ] `.env.example` を更新し、必要な環境変数（Google Sheets / Playwright 等）を共有する。
- [ ] Service Account を発行し、対象 Spreadsheet へのアクセス権を付与する。
- [ ] `GOOGLE_SERVICE_ACCOUNT_BASE64` / `GOOGLE_SHEETS_SPREADSHEET_ID` を設定し、読み書きの PoC を実施する。
- [ ] ダッシュボード・商品詳細モーダル・ジョブステータスビューを実装し、Server Action でユースケースを呼び出す。
- [ ] トースト通知・操作ログ記録など UI の基本動作を完成させる。
- [ ] Playwright スクリプトを作成し、ログイン〜下書き保存直前までの自動化を実装する。
- [ ] CI 用スモークテストとローカル/ステージング用フルテストを用意する。
- [ ] GitHub Actions ワークフローで `pnpm lint` / `pnpm test` / Playwright スモークテストを実行する。
- [ ] Vercel をリポジトリに接続し、Preview / Production デプロイを確認する。
- [ ] Google Sheets にテスト商品を登録し、同期→送信→下書き確認フローを通す。
- [ ] エラーハンドリング・ログ保存・操作ログ記録が期待通りか確認する。
- [ ] 運用チェックリストに沿って最終確認し、Playwright スモークテストや手動操作を完了する。
- [ ] 本番シートに商品を投入し、Playwright 更新・ログ確認・資格情報ローテーションなど定期メンテナンスを開始する。

## 運用チェックリスト
- **送信前（シート側）**
  - 必須項目（タイトル、価格、説明、カテゴリ、発送元、出品先、ステータス）が埋まっているか確認。
  - PF固有の列（カテゴリID、発送方法ID など）に漏れがないかチェック。
  - 画像URL、タグが仕様に沿っているか（枚数・文字数・形式）。
- **送信前（ダッシュボード側）**
  - 最新同期を実行し、対象商品のステータスが「下書き準備済み」になっているか確認。
  - 対象商品を選択し、送信前に詳細モーダルで内容を再確認。
- **送信中 / エラー発生時**
  - トースト通知で進捗を確認。失敗時はエラーメッセージを控え、`last_error_message` を参照。
  - 原因がスプレッドシートの入力不備であれば修正後にステータスを「下書き準備済み」に戻し、再送信。
  - PF 側の仕様変更などが疑われる場合は Playwright をヘッドフルモードで再実行し、DOM 変更点を調査。
- **下書き確認・公開**
  - Creema / minne の管理画面で下書きを開き、商品情報・画像が正しく反映されているか確認。
  - 必要に応じて微調整し、手動で公開。公開後はシートのステータスを「公開済み」に更新。
- **定期的なメンテナンス**
  - 定期的にテスト商品で送信スモークテストを実施し、Playwright ジョブの正常性を確認。
  - 操作ログ（ジョブ履歴）を 30 日単位で確認し、異常なエラーが増えていないかを見る。
  - 環境変数や認証情報の期限切れがないか四半期ごとにチェック。

## 監視・アラート方針
- **ログ収集**: Playwright ジョブ実行時のログ・スクリーンショット・HTML ダンプを `SubmissionJob` とストレージに保存。異常時に復旧しやすいようメッセージを詳細に残す。
- **メトリクス**: `MetricsPort` でジョブ成功数、失敗数、平均処理時間、タイムアウト件数を収集。日次でダッシュボードに集計し、増減を確認する。
- **しきい値**: 直近 10 ジョブで 3 件以上失敗した場合、または 1 ジョブの処理時間が 5 分を超えた場合は手動調査を実施（ヘッドフル再現・DOM 変更確認）。
- **通知手段**: 現時点では管理画面のトースト通知を中心に運用し、監視で検知した異常は週次レポートや Issue 化で共有。Slack / メール通知は将来必要になった際に `NotificationPort` 経由で追加する。
- **エラー追跡**: Playwright で捕捉した例外を Sentry などのエラートラッキング（導入検討中）に送信できるようにし、ブラウザ操作エラーと Node.js 例外を可視化する。
- **定期レビュー**: 四半期に一度、失敗ログ・メトリクス・復旧履歴を振り返り、リトライポリシーや Playwright スクリプトの改善に活かす。

---
このREADMEが常に最新の仕様・方針を反映するよう、変更時は内容をレビューしてから反映してください。
