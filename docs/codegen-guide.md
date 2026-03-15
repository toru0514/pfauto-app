# Playwright Codegen ガイド — セレクタ収集手順

このガイドでは、各ECプラットフォームのフォームセレクタを Playwright CLI (`codegen`) で収集する手順を説明します。

## 前提条件

- Node.js がインストール済み
- `pnpm install` 実行済み（Playwright がインストール済み）
- 各プラットフォームのアカウント（メール/パスワード）を用意

```bash
# Playwright ブラウザがインストールされていない場合
npx playwright install chromium
```

## 基本的な使い方

```bash
# URL を指定して codegen を起動 → ブラウザが開き操作を記録
npx playwright codegen <URL>

# auth 状態を保存（ログイン後に使用）
npx playwright codegen --save-storage=playwright/.auth/<platform>-auth.json <URL>

# 保存済み auth 状態を読み込んで起動（ログイン済み状態で開始）
npx playwright codegen --load-storage=playwright/.auth/<platform>-auth.json <URL>
```

---

## プラットフォーム別手順

### 1. Creema（email + password）

```bash
# Step 1: ログインフロー記録 + auth保存
npx playwright codegen --save-storage=playwright/.auth/creema-auth.json https://www.creema.jp/user/login
```

**操作手順:**
1. メールアドレスを入力
2. パスワードを入力
3. ログインボタンをクリック
4. ログイン完了後、Codegen ウィンドウを閉じる（auth が保存される）

```bash
# Step 2: 商品登録フォーム記録
npx playwright codegen --load-storage=playwright/.auth/creema-auth.json https://www.creema.jp/my/item/create
```

**操作手順:**
1. タイトル入力
2. 説明入力
3. カテゴリ選択（第1〜3階層すべて）
4. 価格入力
5. 在庫数選択
6. 素材選択
7. 色選択（チェックボックス）
8. 画像アップロード
9. サイズ入力
10. 「次へ」ボタンクリック → 発送情報ページへ
11. 発送元都道府県選択
12. 配送方法選択
13. 制作期間選択
14. 確認ボタンクリック
15. 下書き保存ボタンクリック

**保存先:** `playwright/tests/codegen-output/creema-login.ts`, `creema-form.ts`

---

### 2. iichi（email + password）

```bash
# Step 1: ログイン
npx playwright codegen --save-storage=playwright/.auth/iichi-auth.json https://www.iichi.com/signin

# Step 2: フォーム記録
npx playwright codegen --load-storage=playwright/.auth/iichi-auth.json https://www.iichi.com/your/item/create
```

**操作手順:**
1. タイトル入力
2. 説明入力
3. カテゴリ選択（親・子）— Element Plus ドロップダウン
4. 素材選択
5. 価格入力
6. 在庫数入力
7. 画像アップロード
8. 配送方法選択
9. 保存ボタンクリック

**保存先:** `playwright/tests/codegen-output/iichi-login.ts`, `iichi-form.ts`

---

### 3. BASE（email + password + 2FA）

```bash
# Step 1: ログイン（2FAあり → 手動でログイン完了後に auth 保存）
npx playwright codegen --save-storage=playwright/.auth/base-auth.json https://admin.thebase.com/users/login

# Step 2: フォーム記録
npx playwright codegen --load-storage=playwright/.auth/base-auth.json https://admin.thebase.com/shop_admin/items/add
```

**注意:** BASE は2FA があるため、ログイン画面でメール・パスワードを入力後、追加認証（メール認証コード等）を手動で完了してからウィンドウを閉じてください。

**操作手順:**
1. 公開/非公開チェックボックスの操作
2. タイトル入力
3. 説明入力
4. 価格入力
5. 在庫数入力
6. 画像アップロード
7. 登録ボタンクリック

**保存先:** `playwright/tests/codegen-output/base-login.ts`, `base-form.ts`

---

### 4. minne（magic link）

```bash
# Step 1: ログイン（magic link → メールのリンクを手動クリック後に auth 保存）
npx playwright codegen --save-storage=playwright/.auth/minne-auth.json https://minne.com/signin

# Step 2: フォーム記録
npx playwright codegen --load-storage=playwright/.auth/minne-auth.json https://minne.com/account/products/new
```

**注意:** minne はパスワード不要のマジックリンク認証です。メールアドレス入力 → 送信後、メールに届いたリンクを同じブラウザで開いてからウィンドウを閉じてください。

**操作手順:**
1. タイトル入力
2. カテゴリ選択（親・子）
3. 説明入力
4. 価格入力
5. 在庫数入力
6. 配送日数入力
7. 画像アップロード
8. 配送方法選択
9. 配送地域入力
10. 配送料入力
11. 追加配送料入力
12. 登録ボタンクリック

**保存先:** `playwright/tests/codegen-output/minne-login.ts`, `minne-form.ts`

---

## Codegen 操作時のポイント

### 全フィールドを操作する
現在の自動化に含まれていないフィールドも含め、画面上の**すべてのフォーム要素**を操作してください。不足しているフィールドを発見するのが目的の一つです。

### 生成されたコードを確認する
Codegen ウィンドウの右側に生成コードが表示されます。以下のセレクタ優先順位で生成されているか確認してください:

1. `getByRole()` — 最も堅牢
2. `getByLabel()` — フォーム入力向き
3. `getByPlaceholder()` — ラベルがない場合
4. `getByText()` — ボタン/リンク向き
5. `locator()` (CSS) — 上記で対応できない場合

### コードの保存
Codegen ウィンドウ上部の「Copy」ボタンで生成コードをコピーし、以下のファイルに保存してください:

```
playwright/tests/codegen-output/
  creema-login.ts
  creema-form.ts
  minne-login.ts
  minne-form.ts
  base-login.ts
  base-form.ts
  iichi-login.ts
  iichi-form.ts
```

---

## 次のステップ

Codegen 出力ファイルを保存したら、開発者（Claude）が以下を実施します:

1. Codegen セレクタを Page Object に統合
2. Spec ファイルを Page Object 使用にリファクタリング
3. 不足フィールドの追加
4. セレクタ健全性チェックテストの作成
