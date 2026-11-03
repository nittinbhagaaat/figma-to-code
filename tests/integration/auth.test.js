import { describe, it, expect } from "vitest";
import { Client, uid, PASSWORD, lastEmail, tokenFrom } from "./helpers.js";

describe("authentication", () => {
  const email = `auth-${uid()}@example.test`;
  const c = new Client();
  it("validates registration input", async () => {
    expect((await c.post("/api/auth/register", { name: "A", email: "bad", password: "x" })).status).toBe(400);
    expect((await c.post("/api/auth/register", { name: "A", email, password: "alllowercase1" })).status).toBe(400);
  });
  it("registers, blocks login until verified, then verifies and logs in", async () => {
    expect((await c.post("/api/auth/register", { name: "Auth User", email, password: PASSWORD })).status).toBe(200);
    expect((await c.post("/api/auth/register", { name: "Dup", email, password: PASSWORD })).status).toBe(409);
    let r = await c.post("/api/auth/login", { email, password: PASSWORD });
    expect(r.status).toBe(403); expect(r.error.code).toBe("EMAIL_UNVERIFIED");
    const mail = lastEmail(email);
    const token = tokenFrom(mail, /verify-email\?token=([^\s]+)/);
    expect((await c.post("/api/auth/verify-email", { token: "nope-nope-nope" })).status).toBe(400);
    expect((await c.post("/api/auth/verify-email", { token })).status).toBe(200);
    expect((await c.post("/api/auth/verify-email", { token })).status).toBe(400); // single use
    r = await c.post("/api/auth/login", { email, password: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.data.user.email).toBe(email);
    expect(JSON.stringify(r.data)).not.toMatch(/passwordHash|figmaToken/);
  });
  it("sets an HttpOnly session cookie and /me works; logout revokes", async () => {
    const res = await c.req("GET", "/api/auth/me", undefined, { raw: true });
    expect(res.status).toBe(200);
    const login = await new Client().req("POST", "/api/auth/login", { email, password: PASSWORD }, { raw: true });
    const cookie = login.headers.getSetCookie().find((x) => x.startsWith("f2c_session="));
    expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=lax/i);
    expect((await c.post("/api/auth/logout")).status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(401);
  });
  it("rejects wrong passwords uniformly and does not reveal unknown accounts", async () => {
    const a = await new Client().post("/api/auth/login", { email, password: "Wrong-pass1" });
    const b = await new Client().post("/api/auth/login", { email: `nobody-${uid()}@example.test`, password: "Wrong-pass1" });
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.error.message).toBe(b.error.message);
  });
  it("rate limits repeated login attempts", async () => {
    const cc = new Client(); let limited = false;
    for (let i = 0; i < 25 && !limited; i++) limited = (await cc.post("/api/auth/login", { email: `rl-${uid()}@example.test`, password: "Wrong-pass1" })).status === 429;
    expect(limited).toBe(true);
  });
  it("password reset flow invalidates sessions and old password", async () => {
    const x = new Client(); const em = `reset-${uid()}@example.test`;
    await x.post("/api/auth/register", { name: "Reset", email: em, password: PASSWORD });
    await x.post("/api/auth/verify-email", { token: tokenFrom(lastEmail(em), /verify-email\?token=([^\s]+)/) });
    await x.post("/api/auth/login", { email: em, password: PASSWORD });
    expect((await new Client().post("/api/auth/forgot-password", { email: `ghost-${uid()}@example.test` })).status).toBe(200); // no enumeration
    await new Client().post("/api/auth/forgot-password", { email: em });
    const token = tokenFrom(lastEmail(em), /reset-password\?token=([^\s]+)/);
    expect((await new Client().post("/api/auth/reset-password", { token, password: "weak" })).status).toBe(400);
    expect((await new Client().post("/api/auth/reset-password", { token, password: "N3wPassword!" })).status).toBe(200);
    expect((await x.get("/api/auth/me")).status).toBe(401);
    expect((await new Client().post("/api/auth/login", { email: em, password: PASSWORD })).status).toBe(401);
    expect((await new Client().post("/api/auth/login", { email: em, password: "N3wPassword!" })).status).toBe(200);
  });
  it("blocks cross-origin mutating requests", async () => {
    const r = await new Client().req("POST", "/api/auth/login", { email, password: PASSWORD }, { headers: { Origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });
});
