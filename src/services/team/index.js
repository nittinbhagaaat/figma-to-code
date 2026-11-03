import Invitation from "@/models/Invitation";
import Workspace from "@/models/Workspace";
import User from "@/models/User";
import { randomToken, sha256 } from "@/lib/crypto";
import { badRequest, conflict, forbidden, notFound, AppError } from "@/lib/errors";
import { canInviteRole, canManageRole, canRemoveMember } from "@/lib/permissions";
import { requireWorkspace } from "@/services/workspace/access";
import { logActivity, notify } from "@/services/workspace/activity";
import { sendInvitationEmail } from "@/services/email";

const TTL_MS = 7 * 86400e3;

export const invitationStatus = (i) => (i.status === "pending" && i.expiresAt < new Date() ? "expired" : i.status);
const serializeInvite = (i) => ({
  id: String(i._id), email: i.email, role: i.role, status: invitationStatus(i),
  expiresAt: i.expiresAt, acceptedAt: i.acceptedAt, createdAt: i.createdAt, invitedBy: String(i.invitedBy),
});

export async function listMembers(user, workspaceId) {
  const { workspace, role } = await requireWorkspace(user, workspaceId, "member:view");
  const users = await User.find({ _id: { $in: workspace.members.map((m) => m.user) } }).select("name email avatar").lean();
  const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
  return {
    myRole: role,
    members: workspace.members.map((m) => ({
      userId: String(m.user), role: m.role, joinedAt: m.joinedAt,
      name: byId[String(m.user)]?.name || "Unknown", email: byId[String(m.user)]?.email || "", avatar: byId[String(m.user)]?.avatar || "",
    })),
  };
}

export async function listInvitations(user, workspaceId) {
  await requireWorkspace(user, workspaceId, "member:invite");
  const list = await Invitation.find({ workspace: workspaceId }).sort({ createdAt: -1 }).limit(200);
  return list.map(serializeInvite);
}

async function deliver(invite, workspace, inviter, token) {
  try {
    const r = await sendInvitationEmail({ to: invite.email, inviterName: inviter.name, workspaceName: workspace.name, role: invite.role, token });
    return r.delivered;
  } catch (e) { console.error("[email] invitation failed", e.message); return false; }
}

export async function createInvitation(user, workspaceId, { email, role }) {
  const { workspace, role: myRole } = await requireWorkspace(user, workspaceId, "member:invite");
  if (!canInviteRole(myRole, role)) throw forbidden("You cannot invite members with that role");
  const existingUser = await User.findOne({ email }).select("_id").lean();
  if (existingUser && workspace.members.some((m) => String(m.user) === String(existingUser._id))) throw conflict("That person is already a member");
  const dupe = await Invitation.findOne({ workspace: workspace._id, email, status: "pending", expiresAt: { $gt: new Date() } });
  if (dupe) throw conflict("A pending invitation already exists for this email");
  const token = randomToken(32);
  const invite = await Invitation.create({ workspace: workspace._id, email, role, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS), invitedBy: user.id });
  const emailDelivered = await deliver(invite, workspace, user, token);
  await logActivity({ workspace: workspace._id, actor: user.id, action: "invite.sent", message: `${user.name} invited ${email} as ${role}` });
  if (existingUser) await notify([existingUser._id], { workspace: workspace._id, type: "invitation", message: `${user.name} invited you to ${workspace.name}`, link: `/invite/${token}` });
  return { ...serializeInvite(invite), emailDelivered };
}

export async function resendInvitation(user, invitationId) {
  const invite = await Invitation.findById(invitationId);
  if (!invite) throw notFound("Invitation not found");
  const { workspace } = await requireWorkspace(user, invite.workspace, "member:invite");
  if (invite.status !== "pending") throw badRequest("Only pending invitations can be resent");
  const token = randomToken(32);
  invite.tokenHash = sha256(token);
  invite.expiresAt = new Date(Date.now() + TTL_MS);
  await invite.save();
  const emailDelivered = await deliver(invite, workspace, user, token);
  return { ...serializeInvite(invite), emailDelivered };
}

export async function cancelInvitation(user, invitationId) {
  const invite = await Invitation.findById(invitationId);
  if (!invite) throw notFound("Invitation not found");
  await requireWorkspace(user, invite.workspace, "member:invite");
  if (invite.status === "accepted") throw badRequest("Invitation was already accepted");
  invite.status = "cancelled";
  await invite.save();
}

/** Public, token-based preview so the invite page can show what is being offered before sign-in. */
export async function previewInvitation(token) {
  const invite = await Invitation.findOne({ tokenHash: sha256(token) });
  if (!invite) throw notFound("This invitation link is invalid");
  const ws = await Workspace.findById(invite.workspace).select("name").lean();
  return { workspaceName: ws?.name || "Workspace", email: invite.email, role: invite.role, status: invitationStatus(invite) };
}

export async function acceptInvitation(user, token) {
  const invite = await Invitation.findOne({ tokenHash: sha256(token) });
  if (!invite) throw notFound("This invitation link is invalid");
  const status = invitationStatus(invite);
  if (status === "expired") throw new AppError("This invitation has expired. Ask for a new one.", 410, "EXPIRED");
  if (status !== "pending") throw new AppError(`This invitation was ${status}`, 410, "GONE");
  if (invite.email !== user.email) throw forbidden(`This invitation was sent to ${invite.email}. Sign in with that address to accept it.`);
  if (!user.emailVerified) throw forbidden("Verify your email before accepting invitations");
  // Atomic claim so a token can't be redeemed twice concurrently.
  const claimed = await Invitation.findOneAndUpdate({ _id: invite._id, status: "pending" }, { status: "accepted", acceptedAt: new Date(), acceptedBy: user.id });
  if (!claimed) throw new AppError("This invitation was already used", 410, "GONE");
  await Workspace.updateOne({ _id: invite.workspace, "members.user": { $ne: user.id } }, { $push: { members: { user: user.id, role: invite.role } } });
  const ws = await Workspace.findById(invite.workspace);
  await logActivity({ workspace: invite.workspace, actor: user.id, action: "member.joined", message: `${user.name} joined as ${invite.role}` });
  await notify([invite.invitedBy], { workspace: invite.workspace, type: "member-joined", message: `${user.name} accepted your invitation to ${ws.name}`, link: `/workspaces/${ws._id}` });
  return { workspaceId: String(ws._id), role: invite.role };
}

export async function changeMemberRole(user, workspaceId, memberId, role) {
  const { workspace, role: myRole } = await requireWorkspace(user, workspaceId, "member:changeRole");
  const target = workspace.members.find((m) => String(m.user) === String(memberId));
  if (!target) throw notFound("Member not found");
  if (!canManageRole(myRole, target.role, role)) throw forbidden("You cannot change this member's role");
  target.role = role;
  await workspace.save();
  await logActivity({ workspace: workspace._id, actor: user.id, action: "member.role", message: `${user.name} changed a member's role to ${role}` });
  await notify([target.user], { workspace: workspace._id, type: "role-changed", message: `Your role in ${workspace.name} is now ${role}` });
}

export async function removeMember(user, workspaceId, memberId) {
  const { workspace, role: myRole } = await requireWorkspace(user, workspaceId, "workspace:view");
  const target = workspace.members.find((m) => String(m.user) === String(memberId));
  if (!target) throw notFound("Member not found");
  const self = String(memberId) === user.id;
  if (target.role === "owner") throw forbidden("The owner cannot be removed");
  if (!self && !canRemoveMember(myRole, target.role)) throw forbidden("You cannot remove this member");
  workspace.members = workspace.members.filter((m) => String(m.user) !== String(memberId));
  await workspace.save();
  await logActivity({ workspace: workspace._id, actor: user.id, action: self ? "member.left" : "member.removed", message: self ? `${user.name} left the workspace` : `${user.name} removed a member` });
  if (!self) await notify([target.user], { workspace: workspace._id, type: "removed", message: `You were removed from ${workspace.name}` });
}
