import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { downloadImages, cleanupTempFiles } from "../shared/utils";

/**
 * Page Object for BASE product creation form.
 */
export class BasePage {
  readonly page: Page;
  readonly baseOrigin: string;

  // --- Login selectors ---
  readonly emailInput: Locator;
  readonly passwordInput: Locator;

  // --- Form selectors ---
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly priceInput: Locator;
  readonly stockInput: Locator;
  readonly imageFileInput: Locator;

  // --- Publish toggle ---
  readonly publishInput: Locator;
  readonly publishToggleArea: Locator;

  // --- Navigation ---
  readonly registerButton: Locator;

  constructor(page: Page, baseOrigin = "https://admin.thebase.com") {
    this.page = page;
    this.baseOrigin = baseOrigin;

    // Login - multiple selector fallbacks for resilience
    this.emailInput = page
      .locator("input[type='email'], input[name='email'], input#user_email")
      .first();
    this.passwordInput = page
      .locator(
        "input[type='password'], input[name='password'], input#user_password"
      )
      .first();

    // Form fields
    this.titleInput = page.getByRole('textbox', { name: '商品名' });
    this.descriptionInput = page.getByRole('textbox', { name: '商品説明' });
    this.priceInput = page.getByRole('textbox', { name: /価格/ });
    this.stockInput = page.getByRole('textbox', { name: /在庫/ });
    this.imageFileInput = page.locator(
      "input.m-uploadBox__input[type='file']"
    );

    // Publish toggle
    this.publishInput = page
      .locator('label')
      .filter({ hasText: '非公開' })
      .locator('input[type="checkbox"]');
    this.publishToggleArea = page
      .locator('label')
      .filter({ hasText: '非公開' });

    // Navigation
    this.registerButton = page
      .getByRole("button", { name: /商品を登録/i })
      .first();
  }

  async navigateToLogin() {
    await this.page.goto(`${this.baseOrigin}/users/login`, {
      waitUntil: "domcontentloaded",
    });
    await expect(this.page).toHaveURL(/\/users\/login/);
    await expect(this.page.locator("form")).toBeVisible();
  }

  async fillCredentials(email: string, password: string) {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async waitForManualLogin() {
    // User must manually click login button and complete 2FA
    await this.page.pause();
  }

  async navigateToItemsList() {
    await this.page.goto(`${this.baseOrigin}/shop_admin/items/`, {
      waitUntil: "domcontentloaded",
    });
    await expect(this.page).toHaveURL(/\/shop_admin\/items\//);
    await expect(
      this.page.getByRole("button", { name: /商品を登録する/i })
    ).toBeVisible();
  }

  async navigateToAddItem() {
    await this.page.getByRole("button", { name: /商品を登録する/i }).click();
    await this.page.waitForURL(/\/shop_admin\/items\/add/, {
      waitUntil: "domcontentloaded",
    });
    await expect(this.page).toHaveURL(/\/shop_admin\/items\/add/);
    await expect(this.page.locator("body")).toContainText(/商品登録/i);
  }

  async uncheckPublish() {
    try {
      await this.publishInput.first().waitFor({
        state: "attached",
        timeout: 5000,
      });
      const inputHandle = this.publishInput.first();
      if (await inputHandle.isChecked()) {
        try {
          await inputHandle.setChecked(false, { force: true });
        } catch {
          // Fallback: click the label area
        }
      }
      if (await inputHandle.isChecked()) {
        await this.publishToggleArea.first().click({ force: true });
      }
      if (await inputHandle.isChecked()) {
        await this.page.evaluate(() => {
          const label = document.querySelector("p.c-checkbox__text");
          if (label) {
            const checkbox = label
              .closest(".c-checkbox")
              ?.querySelector(
                "input[type='checkbox']"
              ) as HTMLInputElement | null;
            if (checkbox) {
              checkbox.checked = false;
              checkbox.dispatchEvent(
                new Event("change", { bubbles: true })
              );
            }
          }
        });
      }
    } catch {
      console.warn(
        "[base] 公開設定のチェックボックスを操作できませんでした"
      );
    }
  }

  async fillProductForm(title: string, description: string, price: string, stock: string) {
    await this.titleInput.fill(title);
    await this.descriptionInput.fill(description);
    await this.priceInput.fill(price);
    await this.stockInput.fill(stock);
  }

  async uploadImages(imageUrls: string[]): Promise<string[]> {
    const tempFiles = await downloadImages(imageUrls, "base-image");
    let imageFiles = tempFiles;
    const fallback = path.resolve(process.cwd(), "public/vercel.svg");
    if (!imageFiles.length && fs.existsSync(fallback)) {
      imageFiles = [fallback];
    }
    if (imageFiles.length) {
      await this.imageFileInput.setInputFiles(imageFiles);
    }
    return tempFiles; // Caller is responsible for cleanup
  }

  async submitForm() {
    await Promise.all([
      this.page.waitForLoadState("networkidle"),
      this.registerButton.click(),
    ]);
  }
}
