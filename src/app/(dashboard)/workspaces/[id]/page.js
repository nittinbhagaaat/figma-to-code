"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/client-api";
import { can } from "@/lib/permissions";
import { ConfirmDialog, EmptyState, ErrorNote, ListSkeleton, PageHeader, RoleBadge, timeAgo } from "@/components/layout/shared";
import { ProjectDialog, WorkspaceDialog } from "@/components/layout/dialogs";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function WorkspaceDetail({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const ws = useApi(`/api/workspaces/${id}`);
  const projects = useApi(`/api/projects?workspaceId=${id}`);
  const [edit, setEdit] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [del, setDel] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const setWs = useWorkspaceStore((s) => s.setWorkspaceId);
  if (ws.error) return <ErrorNote error={ws.error} retry={ws.reload} />;
  const w = ws.data;
  return (
    <div>
      {!w ? <ListSkeleton rows={1} /> : (<>
        <PageHeader title={w.name} description={w.description || "No description"}
          actions={<>
            <RoleBadge role={w.role} />
            <Button variant="outline" onClick={() => { setWs(id); router.push("/team"); }}><Users />Members</Button>
            {can(w.role, "workspace:update") && <Button variant="outline" onClick={() => setEdit(true)}><Pencil />Edit</Button>}
            {can(w.role, "project:create") && <Button onClick={() => setNewProject(true)}><Plus />New project</Button>}
          </>} />
        <Card className="mb-6"><CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div><p className="text-muted-foreground">Members</p><p className="text-lg font-semibold">{w.memberCount}</p></div>
          <div><p className="text-muted-foreground">Created</p><p className="text-lg font-semibold">{new Date(w.createdAt).toLocaleDateString()}</p></div>
          <div><p className="text-muted-foreground">Last updated</p><p className="text-lg font-semibold">{timeAgo(w.updatedAt)}</p></div>
        </CardContent></Card>
        <h2 className="mb-3 text-lg font-medium">Projects</h2>
        {projects.loading ? <ListSkeleton /> : !projects.data?.length ? (
          <EmptyState title="No projects in this workspace" description="Create a project to import your first design." action={can(w.role, "project:create") && <Button onClick={() => setNewProject(true)}><Plus />New project</Button>} />
        ) : (
          <div className="divide-y rounded-xl border">{projects.data.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40"><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">Updated {timeAgo(p.updatedAt)}</p></div><div className="flex gap-1.5"><Badge variant="outline">{p.framework}</Badge><Badge variant="outline">{p.styling}</Badge></div></Link>))}</div>
        )}
        {can(w.role, "workspace:delete") && (
          <Card className="mt-10 border-destructive/30"><CardHeader><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Deleting a workspace permanently removes its projects, imports and generated versions.</p><Button variant="destructive" onClick={() => setDel(true)}><Trash2 />Delete workspace</Button></CardContent></Card>
        )}
        {edit && <WorkspaceDialog open onOpenChange={setEdit} workspace={w} onDone={ws.reload} />}
        {newProject && <ProjectDialog open onOpenChange={setNewProject} workspaces={[w]} defaultWorkspaceId={id} onDone={projects.reload} />}
        <ConfirmDialog open={del} onOpenChange={(o) => { setDel(o); setConfirmName(""); }} destructive title={`Delete "${w.name}"?`} confirmLabel="Delete forever"
          description={`This permanently deletes ${projects.data?.length ?? 0} project(s) and every version of generated code. This cannot be undone.`}
          onConfirm={async () => { if (confirmName !== w.name) { toast.error("Type the workspace name to confirm"); throw new Error("confirm"); } await api.del(`/api/workspaces/${id}`); toast.success("Workspace deleted"); router.replace("/workspaces"); }}>
          <div className="space-y-1.5"><Label htmlFor="cn">Type <b>{w.name}</b> to confirm</Label><Input id="cn" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} /></div>
        </ConfirmDialog>
      </>)}
    </div>
  );
}
