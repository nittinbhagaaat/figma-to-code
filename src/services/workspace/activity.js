import Activity from "@/models/Activity";
import Notification from "@/models/Notification";

export async function logActivity({ workspace, actor, action, message, project }) {
  try { await Activity.create({ workspace, actor, action, message, project }); } catch (e) { console.error("[activity]", e.message); }
}
export async function notify(userIds, { workspace, type, message, link }) {
  if (!userIds.length) return;
  try { await Notification.insertMany(userIds.map((user) => ({ user, workspace, type, message, link }))); } catch (e) { console.error("[notify]", e.message); }
}
