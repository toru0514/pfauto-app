import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const RUN_BASE_FLOW = process.env.PLAYWRIGHT_RUN_BASE === "true";
const BASE_LOGIN_PATH = "/users/login";
const BASE_ITEMS_PATH = "/shop_admin/items/";
const BASE_ADD_ITEM_PATH = "/shop_admin/items/add";
const LOCAL_SAMPLE_IMAGE = path.resolve(process.cwd(), "public/vercel.svg");

const sampleProduct = {
  name: "BASEテスト商品",
  description:
    "自動化フロー検証用のテスト商品です。サイズ・素材・制作意図など詳細をここに記載します。",
  price: "1200",
  stock: "3",
};

const emailSelector = "input[type='email'], input[name='email'], input#user_email";
const passwordSelector =
  "input[type='password'], input[name='password'], input#user_password";

test.describe("BASE 自動化フロー", () => {
  test.skip(!RUN_BASE_FLOW, "PLAYWRIGHT_RUN_BASE=true を指定したときのみ実行します。");

  test("ログインして管理画面へ遷移する", async ({ page }, testInfo) => {
    const baseEmail = process.env.PLAYWRIGHT_BASE_EMAIL;
    const basePassword = process.env.PLAYWRIGHT_BASE_PASSWORD;
    const baseOrigin = process.env.BASE_BASE_URL ?? "https://admin.thebase.com";

    test.skip(
      !baseEmail || !basePassword,
      "PLAYWRIGHT_BASE_EMAIL / PLAYWRIGHT_BASE_PASSWORD を設定してください。"
    );

    testInfo.annotations.push({
      type: "TODO",
      description:
        "BASE のログインフォーム構造を確認し、セレクタや遷移先URLの検証を確定させる。",
    });

    await test.step("ログインページへ遷移", async () => {
      await page.goto(`${baseOrigin}${BASE_LOGIN_PATH}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/users\/login/);
      await expect(page.locator("form")).toBeVisible();
    });

    await test.step("認証情報を入力する", async () => {
      const emailInput = page.locator(emailSelector).first();
      const passwordInput = page.locator(passwordSelector).first();

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();

      await emailInput.fill(baseEmail!);
      await passwordInput.fill(basePassword!);
    });

    await test.step("手動でログイン/追加認証を完了する", async () => {
      testInfo.annotations.push({
        type: "INFO",
        description:
          "メールアドレス/パスワード入力後、ブラウザ上でログインボタン押下と追加認証を手動で完了し、完了後に Resume を押してください。",
      });
      await page.pause();
    });

    await test.step("商品一覧ページを開く", async () => {
      const openItemsPage = async () => {
        await page.goto(`${baseOrigin}${BASE_ITEMS_PATH}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page).toHaveURL(new RegExp(`${BASE_ITEMS_PATH.replace(/\//g, "\\/")}`));
        await expect(
          page.getByRole("button", { name: /商品を登録する/i })
        ).toBeVisible();
      };

      try {
        await openItemsPage();
      } catch (error) {
        testInfo.annotations.push({
          type: "INFO",
          description:
            "商品を登録するボタンが見えない場合は、ブラウザでログイン/認証手続きを完了してから Resume を押してください。",
        });
        await page.pause();
        await openItemsPage();
      }
    });

    await test.step("商品登録ボタンを押下", async () => {
      await page.getByRole("button", { name: /商品を登録する/i }).click();
      await page.waitForURL(new RegExp(`${BASE_ADD_ITEM_PATH.replace(/\//g, "\\/")}`), {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(new RegExp(`${BASE_ADD_ITEM_PATH.replace(/\//g, "\\/")}`));
      await expect(page.locator("body")).toContainText(/商品登録/i);
    });

    await test.step("公開設定を下書きに変更", async () => {
      const publishInput = page.locator(
        'xpath=//p[contains(normalize-space(),"公開する")]/ancestor::*[self::label or contains(@class,"c-checkbox")][1]//input[@type="checkbox"] | //input[@type="checkbox"][contains(@name,"publish")] | //input[@type="checkbox"][contains(@id,"publish")]'
      );

      const publishToggleArea = page.locator(
        'xpath=//p[contains(normalize-space(),"公開する")]/ancestor::*[self::label or contains(@class,"c-checkbox")]'
      );

      try {
        await publishInput.first().waitFor({ state: "attached", timeout: 5000 });
        const inputHandle = publishInput.first();
        if (await inputHandle.isChecked()) {
          try {
            await inputHandle.setChecked(false, { force: true });
          } catch {
            // fallback to clicking surrounding area
          }
        }

        if (await inputHandle.isChecked()) {
          await publishToggleArea.first().click({ force: true });
        }

        if (await inputHandle.isChecked()) {
          await page.evaluate(() => {
            const label = document.querySelector(
              'p.c-checkbox__text'
            );
            if (label) {
              const checkbox = label.closest(".c-checkbox")?.querySelector("input[type='checkbox']");
              if (checkbox) {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          });
        }
      } catch (error) {
        testInfo.annotations.push({
          type: "WARN",
          description: "公開設定のチェックボックスを操作できませんでした。手動で外してください。",
        });
      }
    });

    await test.step("商品情報を入力", async () => {
      const imagePath = fs.existsSync(LOCAL_SAMPLE_IMAGE)
        ? LOCAL_SAMPLE_IMAGE
        : null;

      await page.locator("#itemDetail_name").fill(sampleProduct.name);
      await page.locator("#itemDetail_detail").fill(sampleProduct.description);
      await page.locator("#itemDetail_price").fill(sampleProduct.price);
      await page.locator("#itemDetail_stock").fill(sampleProduct.stock);

      if (imagePath) {
        await page.setInputFiles("input.m-uploadBox__input[type='file']", imagePath);
      } else {
        testInfo.annotations.push({
          type: "WARN",
          description: "Sample image file not found. 手動で画像をアップロードしてください。",
        });
      }
    });

    await test.step("商品を登録ボタンで送信", async () => {
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page
          .getByRole("button", { name: /商品を登録/i })
          .first()
          .click(),
      ]);
    });
  });
});
