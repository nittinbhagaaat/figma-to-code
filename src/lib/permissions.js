/** Role-based access control. Pure functions — safe to unit-test and to share with the client for UI hints (never for enforcement). */
export const ROLES = ["owner", "admin", "editor", "viewer"];

export const PERMISSIONS = {
  "workspace:view": ["owner", "admin", "editor", "viewer"],
  "workspace:update": ["owner", "admin"],
  "workspace:delete": ["owner"],
  "member:view": ["owner", "admin", "editor", "viewer"],
  "member:invite": ["owner", "admin"],
  "member:remove": ["owner", "admin"],
  "member:changeRole": ["owner", "admin"],
  "project:view": ["owner", "admin", "editor", "viewer"],
  "project:create": ["owner", "admin", "editor"],
  "project:update": ["owner", "admin", "editor"],
  "project:delete": ["owner", "admin"],
  "project:archive": ["owner", "admin"],
  "figma:import": ["owner", "admin", "editor"],
  "code:generate": ["owner", "admin", "editor"],
  "code:edit": ["owner", "admin", "editor"],
  "code:view": ["owner", "admin", "editor", "viewer"],
  "code:export": ["owner", "admin", "editor", "viewer"],
};

export function can(role, permission) {
  return !!role && (PERMISSIONS[permission] || []).includes(role);
}

const rank = { viewer: 0, editor: 1, admin: 2, owner: 3 };

/**
 * Whether `actorRole` may assign/modify `targetRole`.
 * - Nobody can grant 'owner' (ownership is fixed to the workspace owner).
 * - Admins can only manage members whose role is below admin.
 */
export function canManageRole(actorRole, targetRole, newRole) {
  if (!can(actorRole, "member:changeRole")) return false;
  if (targetRole === "owner" || newRole === "owner") return false;
  if (actorRole === "owner") return true;
  return rank[targetRole] < rank.admin && rank[newRole ?? targetRole] < rank.admin;
}
export function canRemoveMember(actorRole, targetRole) {
  if (!can(actorRole, "member:remove")) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  return rank[targetRole] < rank.admin;
}
export function canInviteRole(actorRole, role) {
  if (!can(actorRole, "member:invite")) return false;
  if (role === "owner") return false;
  return actorRole === "owner" || rank[role] < rank.admin;
}
