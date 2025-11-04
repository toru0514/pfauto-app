import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const creemaBaseUrl = process.env.CREEMA_BASE_URL ?? "https://www.creema.jp";

export default defineConfig({
  testDir: "playwright/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 1000 * 60 * 5,
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: "creema-chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: creemaBaseUrl,
        trace: "on-first-retry",
        video: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
  ],
  outputDir: "playwright/artifacts",
});
