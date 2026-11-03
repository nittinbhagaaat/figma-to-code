import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import Session from "@/models/Session";
import User from "@/models/User";

export const SESSION_COOKIE = "f2c_session";
const DAY = 86400;

/** Always issues a brand-new token (prevents session fixation) and stores only its hash. */
export async function createSession(userId, { remember = false, ip, userAgent } = {}) {
  await connectDB();
  const token = randomToken(32);
  const maxAge = (remember ? 30 : 1) * DAY;
  await Session.create({ user: userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + maxAge * 1000), ip, userAgent: (userAgent || "").slice(0, 200) });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) { await connectDB(); await Session.deleteOne({ tokenHash: sha256(token) }); }
  jar.delete(SESSION_COOKIE);
}

/** Returns the authenticated user document (lean, no secrets) or null. */
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDB();
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.user).lean();
  return user ? serializeUser(user) : null;
}

export function serializeUser(u) {
  return { id: String(u._id), name: u.name, email: u.email, emailVerified: !!u.emailVerified, avatar: u.avatar || "", hasFigmaToken: !!u.figmaTokenSetAt, lastWorkspace: u.lastWorkspace ? String(u.lastWorkspace) : null, createdAt: u.createdAt };
}

export async function destroyAllSessions(userId) {
  await connectDB();
  await Session.deleteMany({ user: userId });
}
