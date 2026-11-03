import { connectDB } from "@/lib/mongodb";
import RateLimit from "@/models/RateLimit";
import { tooMany } from "@/lib/errors";

/**
 * Mongo-backed fixed-window rate limiter (works across server instances).
 * Throws a 429 AppError when exceeded.
 */
export async function rateLimit(key, { limit, windowSec }) {
  await connectDB();
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000));
  const id = `${key}:${windowStart}`;
  const doc = await RateLimit.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowStart + 1) * windowSec * 1000 + 60_000) } },
    { upsert: true, returnDocument: "after" }
  );
  if (doc.count > limit) {
    const retryAfter = Math.ceil(((windowStart + 1) * windowSec * 1000 - now) / 1000);
    throw tooMany(undefined, retryAfter);
  }
}
export async function resetRateLimit(key, windowSec) {
  await connectDB();
  const windowStart = Math.floor(Date.now() / (windowSec * 1000));
  await RateLimit.deleteOne({ _id: `${key}:${windowStart}` });
}
export function clientIp(request) {
  const xf = request.headers.get("x-forwarded-for");
  return (xf ? xf.split(",")[0].trim() : request.headers.get("x-real-ip")) || "unknown";
}
