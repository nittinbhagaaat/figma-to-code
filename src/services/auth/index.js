import bcrypt from "bcryptjs";
import User from "@/models/User";
import Token from "@/models/Token";
import { randomToken, sha256 } from "@/lib/crypto";
import { AppError, badRequest, conflict } from "@/lib/errors";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/services/email";
import { destroyAllSessions } from "./session";

const COST = 12;
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", COST);
const MAX_FAILS = 8;
const LOCK_MIN = 15;

async function issueToken(userId, type, ttlMs) {
  await Token.deleteMany({ user: userId, type });
  const token = randomToken(32);
  await Token.create({ user: userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}
async function consumeToken(token, type) {
  const doc = await Token.findOneAndDelete({ tokenHash: sha256(token), type, expiresAt: { $gt: new Date() } });
  if (!doc) throw badRequest("This link is invalid or has expired");
  return doc;
}

export async function registerUser({ name, email, password }) {
  if (await User.exists({ email })) throw conflict("An account with this email already exists");
  const passwordHash = await bcrypt.hash(password, COST);
  const user = await User.create({ name, email, passwordHash });
  const token = await issueToken(user._id, "verify-email", 24 * 3600e3);
  let mail = { delivered: false };
  try { mail = await sendVerificationEmail(user, token); } catch (e) { console.error("[email] verification failed", e.message); }
  return { user, emailDelivered: mail.delivered };
}

export async function resendVerification(email) {
  const user = await User.findOne({ email });
  if (!user || user.emailVerified) return; // silent: do not reveal account state
  const token = await issueToken(user._id, "verify-email", 24 * 3600e3);
  try { await sendVerificationEmail(user, token); } catch (e) { console.error("[email]", e.message); }
}

export async function verifyEmail(token) {
  const doc = await consumeToken(token, "verify-email");
  await User.updateOne({ _id: doc.user }, { emailVerified: true });
  return true;
}

export async function authenticate({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash +failedLogins +lockedUntil");
  const hash = user?.passwordHash || DUMMY_HASH;
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await bcrypt.compare(password, hash);
    throw new AppError("Account temporarily locked after too many failed attempts. Try again later.", 429, "LOCKED");
  }
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) {
    if (user) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAILS) { user.lockedUntil = new Date(Date.now() + LOCK_MIN * 60e3); user.failedLogins = 0; }
      await user.save();
    }
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }
  if (!user.emailVerified) throw new AppError("Please verify your email before signing in", 403, "EMAIL_UNVERIFIED");
  if (user.failedLogins || user.lockedUntil) { user.failedLogins = 0; user.lockedUntil = undefined; await user.save(); }
  return user;
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return; // always respond identically
  const token = await issueToken(user._id, "reset-password", 3600e3);
  try { await sendPasswordResetEmail(user, token); } catch (e) { console.error("[email]", e.message); }
}

export async function resetPassword(token, password) {
  const doc = await consumeToken(token, "reset-password");
  const passwordHash = await bcrypt.hash(password, COST);
  await User.updateOne({ _id: doc.user }, { passwordHash, failedLogins: 0, $unset: { lockedUntil: 1 } });
  await destroyAllSessions(doc.user); // invalidate every existing session
}

export async function changePassword(userId, current, next) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new AppError("Current password is incorrect", 400, "BAD_PASSWORD");
  user.passwordHash = await bcrypt.hash(next, COST);
  await user.save();
  await destroyAllSessions(userId);
}
