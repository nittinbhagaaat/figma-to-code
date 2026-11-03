import fs from "node:fs";
import http from "node:http";

export const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";

/** Minimal cookie-jar HTTP client for the API. */
export class Client {
  constructor(ip) { this.cookie = ""; this.ip = ip || `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; }
  async req(method, path, body, { raw = false, headers = {} } = {}) {
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: { "x-forwarded-for": this.ip, ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) { const [kv] = c.split(";"); const [k, v] = kv.split("="); if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c) || v === "") this.cookie = this.cookie.split("; ").filter((x) => !x.startsWith(k + "=")).join("; "); else this.cookie = [...this.cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")), kv].join("; "); }
    if (raw) return res;
    const json = await res.json().catch(() => null);
    return { status: res.status, ...json, headers: res.headers };
  }
  get = (p) => this.req("GET", p);
  post = (p, b) => this.req("POST", p, b ?? {});
  patch = (p, b) => this.req("PATCH", p, b);
  put = (p, b) => this.req("PUT", p, b);
  del = (p) => this.req("DELETE", p);
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const PASSWORD = "Sup3rSecret!";

/** Reads the newest dev-outbox email for an address and extracts the first URL token. */
export function lastEmail(to) {
  const lines = fs.existsSync(".data/outbox.jsonl") ? fs.readFileSync(".data/outbox.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  return lines.reverse().find((m) => m.to === to);
}
export const tokenFrom = (mail, re) => decodeURIComponent((mail.text.match(re) || [])[1] || "");

export async function registerVerifyLogin(name = "Tester") {
  const c = new Client();
  const email = `${name.toLowerCase()}-${uid()}@example.test`;
  let r = await c.post("/api/auth/register", { name, email, password: PASSWORD });
  if (r.status !== 200) throw new Error("register failed " + JSON.stringify(r));
  const token = tokenFrom(lastEmail(email), /verify-email\?token=([^\s]+)/);
  r = await c.post("/api/auth/verify-email", { token });
  if (r.status !== 200) throw new Error("verify failed " + JSON.stringify(r));
  r = await c.post("/api/auth/login", { email, password: PASSWORD });
  if (r.status !== 200) throw new Error("login failed " + JSON.stringify(r));
  return { c, email, user: r.data.user };
}

/** Local stand-in for api.figma.com serving real-shaped REST responses from the fixture. */
export function startMockFigma(port = 3199) {
  const fixture = fs.readFileSync("tests/fixtures/landing.rest.json", "utf8");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const hits = { files: 0, rate: 0 };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${port}`);
    if (u.pathname.startsWith("/asset/")) { res.writeHead(200, { "content-type": "image/png" }); return res.end(png); }
    if (req.headers["x-figma-token"] !== "figd_test_token_0123456789abcdef") { res.writeHead(403); return res.end("{}"); }
    if (u.pathname === "/v1/files/BADKEY12345") { res.writeHead(404); return res.end("{}"); }
    if (u.pathname === "/v1/files/RATELIMIT123") { hits.rate++; if (hits.rate < 2) { res.writeHead(429, { "retry-after": "1" }); return res.end("{}"); } }
    if (/^\/v1\/files\/[A-Za-z0-9]+$/.test(u.pathname)) { hits.files++; res.writeHead(200, { "content-type": "application/json" }); return res.end(fixture); }
    if (/\/images$/.test(u.pathname)) { const m = Object.fromEntries(["imgref-aaaa", "imgref-bbbb", "imgref-cccc"].map((r) => [r, `http://127.0.0.1:${port}/asset/${r}`])); res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ meta: { images: m } })); }
    res.writeHead(404); res.end("{}");
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r({ server, hits, close: () => new Promise((c) => server.close(c)) })));
}
