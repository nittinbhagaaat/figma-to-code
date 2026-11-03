// End-to-end browser journey (real Chrome via Playwright). Boots the app + a local Figma API stand-in,
// walks the whole product flow through the UI, then installs and BUILDS the downloaded ZIP project.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import JSZip from "jszip";
import { chromium } from "playwright-core";
import { startMockFigma } from "../tests/integration/helpers.js";

const PORT = 3101, DB = `figma2code_e2e_${Date.now()}`, BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, PORT: String(PORT), MONGODB_URI: `mongodb://127.0.0.1:27017/${DB}`, APP_URL: BASE, APP_SECRET: "e2e-secret-e2e-secret-e2e-secret", STORAGE_LOCAL_DIR: `.data/e2e-storage-${DB}`, FIGMA_API_BASE: "http://127.0.0.1:3199/v1" };
const FRAMEWORKS = process.argv.includes("--all") ? [["React", "Tailwind CSS"], ["Next.js", "Plain CSS"], ["HTML / CSS / JS", "Tailwind CSS"]] : [["React", "Tailwind CSS"]];
const step = (m) => console.log(`\n▶ ${m}`);
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };

const mock = await startMockFigma();
const server = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", (d) => (log += d)); server.stderr.on("data", (d) => (log += d));
let browser, code = 0;
const outbox = () => (fs.existsSync(".data/outbox.jsonl") ? fs.readFileSync(".data/outbox.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []);
const mailTo = (to, re) => { const m = outbox().reverse().find((x) => x.to === to); return m && decodeURIComponent((m.text.match(re) || [])[1] || ""); };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE + "/api/auth/me")).status) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
  browser = await chromium.launch({ channel: "chrome" });
  const email = `e2e-${Date.now()}@example.test`, invitee = `mate-${Date.now()}@example.test`;
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const _goto = page.goto.bind(page);
  page.goto = async (u, o) => { const r = await _goto(u, o); await page.waitForLoadState("networkidle"); return r; };
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  step("1-2. Register and verify email");
  await page.goto(BASE + "/register");
  await page.getByLabel("Full name").fill("E2E Designer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Sup3rSecret!");
  await page.getByLabel("Confirm password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Check your inbox").waitFor();
  await page.goto(`${BASE}/verify-email?token=${encodeURIComponent(mailTo(email, /verify-email\?token=([^\s]+)/))}`);
  await page.getByText("Email verified").waitFor();

  step("3. Log in");
  await page.getByRole("link", { name: "Continue to sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  step("4. Create a workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByLabel("Name").fill("E2E Studio");
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  await page.getByText("Workspace created").waitFor();

  step("5. Invite a team member");
  await page.goto(BASE + "/team");
  await page.getByLabel("Email address").fill(invitee);
  await page.getByRole("button", { name: "Send invite" }).click();
  await page.getByText(invitee, { exact: true }).first().waitFor();
  assert(mailTo(invitee, /invite\/([^\s]+)/), "invitation email token captured");

  step("Settings: save Figma token (server-side only)");
  await page.goto(BASE + "/settings");
  await page.getByLabel("Figma personal access token").fill("figd_test_token_0123456789abcdef");
  await page.getByRole("button", { name: "Save token" }).click();
  await page.getByText("A token is saved").waitFor();

  step("6. Create a project");
  await page.goto(BASE + "/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill("Landing Page");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[a-f0-9]{24}$/);
  const projectUrl = page.url();

  step("7. Import a Figma design (URL)");
  await page.getByLabel("Figma design URL").fill("https://www.figma.com/design/ABCDEF1234567/Landing");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByText("Design imported").waitFor();
  await page.getByRole("tree").waitFor();

  step("8. Inspect and select frames");
  await page.getByRole("treeitem", { name: /Landing Page/ }).click();
  await page.getByText("Auto Layout", { exact: false }).first().waitFor();
  const preview = page.frameLocator('iframe[title="Design preview"]');
  await preview.getByText("Ship designs").first().waitFor();
  await page.getByRole("checkbox", { name: "Convert Landing Page" }).click();
  await page.getByRole("button", { name: /Convert 1 selected/ }).click();

  for (const [fwLabel, stLabel] of FRAMEWORKS) {
    step(`9-10. Choose ${fwLabel} + ${stLabel} and generate`);
    await page.getByRole("tab", { name: "Convert" }).click();
    await page.getByRole("radio", { name: new RegExp("^" + fwLabel.replace(/[/.]/g, "\\$&")) }).click();
    await page.getByRole("radio", { name: new RegExp("^" + stLabel) }).click();
    await page.getByRole("button", { name: "Generate code" }).click();
    await page.getByText(/Version \d+ generated/).first().waitFor();
    await page.getByRole("button", { name: "Open in Studio" }).first().click();
    await page.waitForURL(/\/studio\//);

    step("11. Edit generated code in Monaco");
    await page.locator(".monaco-editor").first().waitFor();
    const entry = fwLabel === "React" ? "App.jsx" : fwLabel === "Next.js" ? "page.js" : "index.html";
    await page.locator('[role="tree"]').getByRole("button", { name: entry }).first().click();
    await page.locator(".monaco-editor .view-lines").first().click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(fwLabel === "HTML / CSS / JS" ? "\n<!-- e2e edit -->" : "\n// e2e edit");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText(/Saved 1 file/).waitFor();

    step("12. Live preview renders in the sandboxed iframe");
    const iframe = page.locator('iframe[title="Live preview"]');
    assert((await iframe.getAttribute("sandbox")) === "allow-scripts", "preview sandbox must be exactly allow-scripts");
    const live = page.frameLocator('iframe[title="Live preview"]');
    await live.getByText("Ship designs").first().waitFor({ timeout: 45000 });
    await live.getByText("Auto Layout").first().waitFor();
    assert(await live.locator("img").count() >= 3, "preview shows the card images");
    const escaped = await page.evaluate(() => { try { return !!document.querySelector('iframe[title="Live preview"]').contentDocument; } catch { return false; } });
    assert(!escaped, "parent page must not be able to read the sandboxed document");
    await page.screenshot({ path: path.join(os.tmpdir(), `e2e-studio-${entry}.png`) });

    step("13. Save a version");
    await page.getByRole("button", { name: "Save version" }).click();
    await page.getByLabel("Label (optional)").fill("e2e edit");
    await page.getByRole("dialog").getByRole("button", { name: "Save version" }).click();
    await page.getByText(/Saved as v\d+/).waitFor();

    step("14. Download the ZIP");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "ZIP" }).click()]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f2c-e2e-"));
    const zipPath = path.join(dir, "project.zip"); await dl.saveAs(zipPath);
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const out = path.join(dir, "project");
    for (const [name, f] of Object.entries(zip.files)) { if (f.dir) continue; fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true }); fs.writeFileSync(path.join(out, name), await f.async("nodebuffer")); }
    assert(fs.readFileSync(path.join(out, fwLabel === "React" ? "src/App.jsx" : fwLabel === "Next.js" ? "app/page.js" : "index.html"), "utf8").includes("e2e edit"), "the manual edit is inside the exported ZIP");
    assert(!fs.readdirSync(out, { recursive: true }).some((f) => /\.tsx?$/.test(f)), "no TypeScript files in output");

    step(`15. Build ${fwLabel} project from the ZIP`);
    const pkg = JSON.parse(fs.readFileSync(path.join(out, "package.json"), "utf8"));
    if (pkg.scripts.build) {
      execSync("npm install --no-audit --no-fund --loglevel=error", { cwd: out, stdio: "inherit" });
      execSync("npm run build", { cwd: out, stdio: "inherit" });
      console.log("  build OK");
    } else console.log("  (static HTML project: no build step)");
    if (fwLabel === "HTML / CSS / JS") {
      const p2 = await ctx.newPage(); await p2.goto("file://" + path.join(out, "index.html")); await p2.waitForTimeout(1500);
      assert((await p2.locator("main").count()) === 1 && (await p2.getByText("Ship designs").count()) > 0, "downloaded HTML renders"); await p2.close();
    }
    if (FRAMEWORKS.length > 1) { await page.goto(projectUrl); await page.getByRole("tab", { name: "Convert" }).click(); }
  }
  console.log("\n✅ E2E journey passed");
} catch (e) {
  code = 1; console.error("\n❌ E2E failed:", e.message); console.error(log.split("\n").slice(-25).join("\n"));
} finally {
  await browser?.close(); await mock.close(); server.kill("SIGTERM");
  try { await mongoose.connect(env.MONGODB_URI); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  fs.rmSync(env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  process.exit(code);
}
