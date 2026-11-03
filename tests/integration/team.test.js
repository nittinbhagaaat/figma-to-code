import { describe, it, expect } from "vitest";
import { Client, registerVerifyLogin, lastEmail, tokenFrom, uid, PASSWORD } from "./helpers.js";

describe("workspaces, projects, RBAC and invitations", () => {
  it("runs the collaboration lifecycle with backend-enforced roles", async () => {
    const owner = await registerVerifyLogin("Owner");
    let r = await owner.c.post("/api/workspaces", { name: "Acme", description: "Team" });
    expect(r.status).toBe(200);
    const ws = r.data.id;
    expect(r.data.role).toBe("owner");
    expect((await owner.c.post("/api/workspaces", { name: "" })).status).toBe(400);

    r = await owner.c.post("/api/projects", { workspaceId: ws, name: "Site", framework: "react", styling: "tailwind" });
    expect(r.status).toBe(200); const pid = r.data.id;

    // invite a viewer (new person who registers afterwards)
    const viewerEmail = `viewer-${uid()}@example.test`;
    r = await owner.c.post(`/api/workspaces/${ws}/invitations`, { email: viewerEmail, role: "viewer" });
    expect(r.status).toBe(200); expect(r.data.status).toBe("pending");
    expect((await owner.c.post(`/api/workspaces/${ws}/invitations`, { email: viewerEmail, role: "viewer" })).status).toBe(409);
    const token = tokenFrom(lastEmail(viewerEmail), /invite\/([^\s]+)/);
    expect(token.length).toBeGreaterThan(20);

    const v = new Client();
    expect((await v.get(`/api/invitations/preview?token=${token}`)).data).toMatchObject({ workspaceName: "Acme", role: "viewer", email: viewerEmail });
    await v.post("/api/auth/register", { name: "Viewer", email: viewerEmail, password: PASSWORD });
    await v.post("/api/auth/verify-email", { token: tokenFrom(lastEmail(viewerEmail), /verify-email\?token=([^\s]+)/) });
    await v.post("/api/auth/login", { email: viewerEmail, password: PASSWORD });
    expect((await v.post("/api/invitations/accept", { token: "x".repeat(30) })).status).toBe(404);
    // a different verified user cannot redeem someone else's invitation
    const other = await registerVerifyLogin("Other");
    expect((await other.c.post("/api/invitations/accept", { token })).status).toBe(403);
    expect((await v.post("/api/invitations/accept", { token })).status).toBe(200);
    expect((await v.post("/api/invitations/accept", { token })).status).toBe(410); // single use

    // viewer permissions
    expect((await v.get(`/api/projects/${pid}`)).status).toBe(200);
    expect((await v.post("/api/projects", { workspaceId: ws, name: "Nope" })).status).toBe(403);
    expect((await v.patch(`/api/projects/${pid}`, { name: "Hacked" })).status).toBe(403);
    expect((await v.del(`/api/projects/${pid}`)).status).toBe(403);
    expect((await v.post(`/api/workspaces/${ws}/invitations`, { email: "z@example.test", role: "viewer" })).status).toBe(403);
    expect((await v.del(`/api/workspaces/${ws}`)).status).toBe(403);
    expect((await v.put(`/api/projects/${pid}/files`, { changes: [] })).status).toBe(403);

    // non-members get 404 (no existence leak)
    expect((await other.c.get(`/api/workspaces/${ws}`)).status).toBe(404);
    expect((await other.c.get(`/api/projects/${pid}`)).status).toBe(404);
    expect((await other.c.get("/api/projects")).data).toEqual([]);

    // role change: owner promotes viewer to editor; editor can create projects but not invite
    const members = (await owner.c.get(`/api/workspaces/${ws}/members`)).data.members;
    const vm = members.find((m) => m.email === viewerEmail);
    expect((await owner.c.patch(`/api/workspaces/${ws}/members/${vm.userId}`, { role: "owner" })).status).toBe(400); // schema forbids
    expect((await owner.c.patch(`/api/workspaces/${ws}/members/${vm.userId}`, { role: "editor" })).status).toBe(200);
    expect((await v.post("/api/projects", { workspaceId: ws, name: "Editor project" })).status).toBe(200);
    expect((await v.post(`/api/workspaces/${ws}/invitations`, { email: "q@example.test", role: "viewer" })).status).toBe(403);
    // admin cannot demote/remove the owner or invite admins
    const adminInv = await owner.c.post(`/api/workspaces/${ws}/invitations`, { email: other.email, role: "admin" });
    const t2 = tokenFrom(lastEmail(other.email), /invite\/([^\s]+)/);
    expect((await other.c.post("/api/invitations/accept", { token: t2 })).status).toBe(200);
    expect((await other.c.post(`/api/workspaces/${ws}/invitations`, { email: "a@example.test", role: "admin" })).status).toBe(403);
    expect((await other.c.del(`/api/workspaces/${ws}/members/${owner.user.id}`)).status).toBe(403);
    expect((await other.c.del(`/api/workspaces/${ws}`)).status).toBe(403);
    // admin can remove the editor
    expect((await other.c.del(`/api/workspaces/${ws}/members/${vm.userId}`)).status).toBe(200);
    expect((await v.get(`/api/projects/${pid}`)).status).toBe(404);

    // cancel / resend
    const inv2 = await owner.c.post(`/api/workspaces/${ws}/invitations`, { email: `c-${uid()}@example.test`, role: "editor" });
    expect((await owner.c.post(`/api/workspaces/${ws}/invitations/${inv2.data.id}/resend`)).status).toBe(200);
    expect((await owner.c.del(`/api/invitations/${inv2.data.id}`)).status).toBe(200);
    const list = (await owner.c.get(`/api/workspaces/${ws}/invitations`)).data;
    expect(list.find((i) => i.id === inv2.data.id).status).toBe("cancelled");
    expect(adminInv.status).toBe(200);

    // dashboard reflects real data
    const dash = (await owner.c.get("/api/dashboard")).data;
    expect(dash.stats.workspaces).toBe(1); expect(dash.stats.projects).toBeGreaterThanOrEqual(2);
    expect(dash.activity.length).toBeGreaterThan(0);

    // project lifecycle + safe workspace deletion
    r = await owner.c.post(`/api/projects/${pid}/duplicate`); expect(r.status).toBe(200);
    expect((await owner.c.patch(`/api/projects/${pid}`, { status: "archived" })).status).toBe(200);
    expect((await owner.c.get(`/api/projects?workspaceId=${ws}`)).data.some((p) => p.id === pid)).toBe(false);
    expect((await owner.c.del(`/api/workspaces/${ws}`)).status).toBe(200);
    expect((await owner.c.get(`/api/projects/${pid}`)).status).toBe(404);
  });
});
