import { z } from "zod";
import { route } from "@/lib/api";
import User from "@/models/User";
import { serializeUser } from "@/services/auth/session";
export const PATCH = route({ schema: z.object({ name: z.string().trim().min(1).max(80).optional(), avatar: z.string().max(2000).optional() }) }, async ({ user, body }) => {
  const u = await User.findByIdAndUpdate(user.id, body, { returnDocument: "after" });
  return { user: serializeUser(u) };
});
