import mongoose from "mongoose";
import { env } from "@/lib/env";

const globalRef = globalThis;
if (!globalRef.__mongoose) globalRef.__mongoose = { conn: null, promise: null };

/** Connects once per process (cached across hot reloads). */
export async function connectDB() {
  const cache = globalRef.__mongoose;
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    // Query-injection defence: every request value is parsed by Zod into plain strings/ids before reaching a query (see lib/validation.js).
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env.mongoUri, { bufferCommands: false, serverSelectionTimeoutMS: 8000 }).then((m) => m);
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}
