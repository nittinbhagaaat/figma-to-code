import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve("./src") } },
  test: { environment: "node", include: ["tests/**/*.test.js"], testTimeout: 60000, hookTimeout: 120000 },
});
