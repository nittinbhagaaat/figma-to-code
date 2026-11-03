// Boots a Next dev server against a throwaway MongoDB database, runs the integration suite, tears everything down.
import { spawn } from "node:child_process";
import fs from "node:fs";
import mongoose from "mongoose";

const PORT = 3100;
const DB = `figma2code_test_${Date.now()}`;
const env = { ...process.env, PORT: String(PORT), MONGODB_URI: `mongodb://127.0.0.1:27017/${DB}`, APP_URL: `http://127.0.0.1:${PORT}`, APP_SECRET: "test-secret-test-secret-test-secret", STORAGE_LOCAL_DIR: `.data/test-storage-${DB}`, FIGMA_API_BASE: "http://127.0.0.1:3199/v1", NODE_ENV: "development" };
const server = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", (d) => (log += d)); server.stderr.on("data", (d) => (log += d));
const cleanup = async (code) => {
  server.kill("SIGTERM");
  try { await mongoose.connect(env.MONGODB_URI); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  fs.rmSync(env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  process.exit(code);
};
for (let i = 0; i < 120; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/api/auth/me`); if (r.status) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
  if (i === 119) { console.error("server did not start\n" + log); await cleanup(1); }
}
const t = spawn("npx", ["vitest", "run", "tests/integration", ...process.argv.slice(2)], { env, stdio: "inherit" });
t.on("exit", async (code) => { if (code) console.error("\n--- server log (tail) ---\n" + log.split("\n").slice(-40).join("\n")); await cleanup(code ?? 1); });
