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
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("should fail validation when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("should fail validation when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("should not require Google Sheets vars when USE_MOCK_SHEETS_DATA is true", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.USE_MOCK_SHEETS_DATA = "true";
    delete process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain("GOOGLE_SERVICE_ACCOUNT_BASE64");
    expect(result.missing).not.toContain("GOOGLE_SHEETS_SPREADSHEET_ID");
  });
});
