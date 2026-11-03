import { z } from "zod";
import { route } from "@/lib/api";
import Notification from "@/models/Notification";
export const GET = route(async ({ user }) => {
  const list = await Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(30).lean();
  return { unread: list.filter((n) => !n.read).length, items: list.map((n) => ({ id: String(n._id), type: n.type, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt })) };
});
export const PATCH = route({ schema: z.object({ all: z.boolean().optional(), id: z.string().optional() }) }, async ({ user, body }) => {
  await Notification.updateMany(body.all ? { user: user.id } : { user: user.id, _id: body.id }, { read: true });
  return { done: true };
});
