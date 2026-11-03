"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus, RotateCw, UserMinus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/client-api";
import { can, canInviteRole, canManageRole, canRemoveMember } from "@/lib/permissions";
import { ConfirmDialog, EmptyState, ErrorNote, ListSkeleton, PageHeader, RoleBadge, timeAgo } from "@/components/layout/shared";
import { useWorkspaceStore } from "@/stores/workspace-store";

const statusStyle = { pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400", accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", expired: "bg-muted text-muted-foreground", cancelled: "bg-muted text-muted-foreground" };

export default function TeamPage() {
  const router = useRouter();
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const { data: me } = useApi("/api/auth/me");
  const members = useApi(workspaceId ? `/api/workspaces/${workspaceId}/members` : null);
  const myRole = members.data?.myRole;
  const invites = useApi(workspaceId && can(myRole, "member:invite") ? `/api/workspaces/${workspaceId}/invitations` : null);
  const [email, setEmail] = useState(""); const [role, setRole] = useState("editor"); const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const reloadAll = () => { members.reload(); invites.reload(); };

  if (!workspaceId) return <div><PageHeader title="Team" /><EmptyState icon={Users} title="Select a workspace" description="Pick a workspace in the sidebar to manage its members." /></div>;
  if (members.error) return <ErrorNote error={members.error} retry={members.reload} />;
  const invite = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post(`/api/workspaces/${workspaceId}/invitations`, { email, role }); toast.success(r.emailDelivered ? `Invitation emailed to ${email}` : `Invitation created for ${email} (no email provider configured — see server logs)`); setEmail(""); invites.reload(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); reloadAll(); } catch (e) { toast.error(e.message); } };
  return (
    <div className="space-y-8">
      <PageHeader title="Team" description="Members, roles and invitations for the selected workspace." />
      {can(myRole, "member:invite") && (
        <Card><CardHeader><CardTitle className="text-base">Invite by email</CardTitle></CardHeader><CardContent>
          <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row">
            <Input type="email" required placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" className="sm:flex-1" />
            <Select value={role} onValueChange={setRole}><SelectTrigger className="sm:w-36" aria-label="Role"><SelectValue /></SelectTrigger><SelectContent>{["admin", "editor", "viewer"].filter((r) => canInviteRole(myRole, r)).map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <MailPlus />}Send invite</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">Admins manage projects and people; editors import and generate code; viewers get read-only access. Links expire after 7 days.</p>
        </CardContent></Card>)}
      <section>
        <h2 className="mb-3 text-lg font-medium">Members {members.data && <span className="text-muted-foreground">({members.data.members.length})</span>}</h2>
        {members.loading ? <ListSkeleton /> : (
          <div className="divide-y rounded-xl border">{members.data.members.map((m) => {
            const self = m.userId === me?.user?.id;
            const canRole = canManageRole(myRole, m.role, m.role) && !self;
            return (
              <div key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3"><Avatar className="size-9"><AvatarFallback className="text-xs">{m.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{m.name}{self && <span className="text-muted-foreground"> (you)</span>}</p><p className="text-xs text-muted-foreground">{m.email}</p></div></div>
                <div className="flex items-center gap-2">
                  {canRole ? (
                    <Select value={m.role} onValueChange={(r) => act(() => api.patch(`/api/workspaces/${workspaceId}/members/${m.userId}`, { role: r }), "Role updated")}>
                      <SelectTrigger className="h-8 w-28 capitalize" aria-label={`Role for ${m.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{["admin", "editor", "viewer"].filter((r) => canManageRole(myRole, m.role, r)).map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
                  ) : <RoleBadge role={m.role} />}
                  {(canRemoveMember(myRole, m.role) && !self) && <Button variant="ghost" size="icon" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}><UserMinus className="size-4" /></Button>}
                  {self && m.role !== "owner" && <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>Leave</Button>}
                </div>
              </div>);
          })}</div>)}
      </section>
      {can(myRole, "member:invite") && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Invitations</h2>
          {invites.loading ? <ListSkeleton rows={2} /> : !invites.data?.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No invitations yet.</p> : (
            <div className="divide-y rounded-xl border">{invites.data.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="text-sm font-medium">{i.email}</p><p className="text-xs text-muted-foreground">Invited {timeAgo(i.createdAt)} · {i.status === "pending" ? `expires ${new Date(i.expiresAt).toLocaleDateString()}` : i.status}</p></div>
                <div className="flex items-center gap-2"><RoleBadge role={i.role} /><Badge variant="secondary" className={statusStyle[i.status]}>{i.status}</Badge>
                  {(i.status === "pending" || i.status === "expired") && <Button variant="ghost" size="icon" aria-label="Resend invitation" onClick={() => act(async () => { const r = await api.post(`/api/workspaces/${workspaceId}/invitations/${i.id}/resend`); return r; }, "Invitation resent")}><RotateCw className="size-4" /></Button>}
                  {(i.status === "pending" || i.status === "expired") && <Button variant="ghost" size="icon" aria-label="Cancel invitation" onClick={() => act(() => api.del(`/api/invitations/${i.id}`), "Invitation cancelled")}><X className="size-4" /></Button>}
                </div></div>))}</div>)}
        </section>)}
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} destructive title={removing?.userId === me?.user?.id ? "Leave this workspace?" : `Remove ${removing?.name}?`} confirmLabel={removing?.userId === me?.user?.id ? "Leave" : "Remove"}
        description="They will immediately lose access to the workspace's projects." onConfirm={async () => { await api.del(`/api/workspaces/${workspaceId}/members/${removing.userId}`); toast.success("Done"); reloadAll(); if (removing.userId === me?.user?.id) router.replace("/dashboard"); }} />
    </div>
  );
}
