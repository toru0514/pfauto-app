import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv } from "../../lib/env-validation";

describe("env-validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment to clean state
    process.env = { ...originalEnv };
    // Mock console methods used by logger
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should pass validation with all required variables set", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD_HASH = "$2a$10$validhash";

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("should fail validation when NEXTAUTH_SECRET is missing", () => {
    delete process.env.NEXTAUTH_SECRET;
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD_HASH = "$2a$10$validhash";

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.missing).toContain("NEXTAUTH_SECRET");
  });

  it("should warn when neither DB auth nor env auth is configured", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "認証情報が未設定です。SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY、または ADMIN_EMAIL + ADMIN_PASSWORD_HASH のどちらかを設定してください"
    );
  });

  it("should not warn about auth when env auth is configured", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD_HASH = "$2a$10$validhash";

    const result = validateEnv();

    expect(result.warnings).not.toContain(
      expect.stringContaining("認証情報が未設定です")
    );
  });

  it("should not warn about auth when Supabase auth is configured", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

    const result = validateEnv();

    expect(result.warnings).not.toContain(
      expect.stringContaining("認証情報が未設定です")
    );
  });

  it("should warn when ADMIN_PASSWORD_HASH is not a valid bcrypt hash", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD_HASH = "plaintext-password";

    const result = validateEnv();

    expect(result.warnings).toContain(
      "ADMIN_PASSWORD_HASH does not appear to be a valid bcrypt hash"
    );
  });

  it("should warn when NEXTAUTH_SECRET is using placeholder value", () => {
    process.env.NEXTAUTH_SECRET = "replace-with-strong-secret";
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD_HASH = "$2a$10$validhash";

    const result = validateEnv();

    expect(result.warnings).toContain(
      "NEXTAUTH_SECRET is using the placeholder value"
    );
  });

  it("should not require Google Sheets vars when USE_MOCK_SHEETS_DATA is true", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD_HASH = "$2a$10$validhash";
    process.env.USE_MOCK_SHEETS_DATA = "true";
    delete process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain("GOOGLE_SERVICE_ACCOUNT_BASE64");
    expect(result.missing).not.toContain("GOOGLE_SHEETS_SPREADSHEET_ID");
  });
});
