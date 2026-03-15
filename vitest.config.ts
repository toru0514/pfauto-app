import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/playwright/**"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/**",
        "playwright/**",
        "**/*.d.ts",
        "**/__tests__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
