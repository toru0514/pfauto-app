import { getLogger } from "./logger";

const log = getLogger("env-validation");

type EnvVarConfig = {
  name: string;
  required: boolean;
  description: string;
};

const ENV_VARS: EnvVarConfig[] = [
  {
    name: "NEXTAUTH_SECRET",
    required: true,
    description: "NextAuth.js secret for JWT signing",
  },
  {
    name: "ADMIN_EMAIL",
    required: true,
    description: "Admin user email address",
  },
  {
    name: "ADMIN_PASSWORD_HASH",
    required: true,
    description: "Bcrypt hash of admin password",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_BASE64",
    required: false, // Not required if using mock data
    description: "Base64-encoded Google service account JSON",
  },
  {
    name: "GOOGLE_SHEETS_SPREADSHEET_ID",
    required: false, // Not required if using mock data
    description: "Google Sheets spreadsheet ID",
  },
];

export type ValidationResult = {
  valid: boolean;
  missing: string[];
  warnings: string[];
};

export function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const useMockData = process.env.USE_MOCK_SHEETS_DATA === "true";

  for (const config of ENV_VARS) {
    const value = process.env[config.name];

    if (!value || value.trim() === "") {
      if (config.required) {
        // Special case: Google Sheets vars are only required if not using mock data
        if (
          (config.name === "GOOGLE_SERVICE_ACCOUNT_BASE64" ||
            config.name === "GOOGLE_SHEETS_SPREADSHEET_ID") &&
          useMockData
        ) {
          continue;
        }
        missing.push(config.name);
      }
    }
  }

  // Validate ADMIN_PASSWORD_HASH format
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash && !hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    warnings.push(
      "ADMIN_PASSWORD_HASH does not appear to be a valid bcrypt hash"
    );
  }

  // Warn if using default/placeholder values
  if (process.env.NEXTAUTH_SECRET === "replace-with-strong-secret") {
    warnings.push("NEXTAUTH_SECRET is using the placeholder value");
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function validateEnvOrThrow(): void {
  const result = validateEnv();

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      log.warn(warning);
    }
  }

  if (!result.valid) {
    const message = `Missing required environment variables: ${result.missing.join(", ")}`;
    log.error(message, undefined, { missing: result.missing });
    throw new Error(message);
  }

  log.info("環境変数の検証が完了しました");
}
