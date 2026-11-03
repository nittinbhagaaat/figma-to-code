import { route } from "@/lib/api";
import Project from "@/models/Project";
import GeneratedCode from "@/models/GeneratedCode";
import Activity from "@/models/Activity";
import User from "@/models/User";
import { userWorkspaceIds } from "@/services/workspace/access";
import { listWorkspaces } from "@/services/workspace";
import { serializeProject } from "@/services/project";

/** Dashboard aggregates — every number is computed from the database. */
export const GET = route(async ({ user }) => {
  const wsIds = await userWorkspaceIds(user.id);
  const [workspaces, recentProjects, totalProjects, versions, fileAgg, activity] = await Promise.all([
    listWorkspaces(user),
    Project.find({ workspace: { $in: wsIds }, status: "active" }).sort({ updatedAt: -1 }).limit(6),
    Project.countDocuments({ workspace: { $in: wsIds }, status: "active" }),
    (async () => { const ids = (await Project.find({ workspace: { $in: wsIds } }).select("_id").lean()).map((p) => p._id); return { ids, count: await GeneratedCode.countDocuments({ project: { $in: ids } }) }; })(),
    Project.aggregate([{ $match: { workspace: { $in: wsIds } } }, { $group: { _id: null, n: { $sum: 1 } } }]),
    Activity.find({ workspace: { $in: wsIds } }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const latest = await GeneratedCode.aggregate([{ $match: { project: { $in: versions.ids } } }, { $sort: { version: -1 } }, { $group: { _id: "$project", files: { $first: "$files" } } }]);
  const totalFiles = latest.reduce((s, l) => s + (l.files?.length || 0), 0);
  const actors = await User.find({ _id: { $in: activity.map((a) => a.actor) } }).select("name").lean();
  const nameOf = Object.fromEntries(actors.map((a) => [String(a._id), a.name]));
  return {
    stats: { workspaces: workspaces.length, projects: totalProjects, conversions: versions.count, generatedFiles: totalFiles, archived: (fileAgg[0]?.n || 0) - totalProjects },
    recentWorkspaces: workspaces.slice(0, 4),
    recentProjects: recentProjects.map((p) => serializeProject(p)),
    activity: activity.map((a) => ({ id: String(a._id), message: a.message, action: a.action, actor: nameOf[String(a.actor)] || "Someone", createdAt: a.createdAt, workspace: String(a.workspace) })),
  };
});
