"use client";
import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Copy, FolderKanban, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/client-api";
import { can } from "@/lib/permissions";
import { ConfirmDialog, EmptyState, ErrorNote, ListSkeleton, PageHeader, timeAgo } from "@/components/layout/shared";
import { ProjectDialog } from "@/components/layout/dialogs";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function ProjectsPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const [status, setStatus] = useState("active");
  const workspaces = useApi("/api/workspaces");
  const projects = useApi(`/api/projects?status=${status}${workspaceId ? `&workspaceId=${workspaceId}` : ""}`);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const roleOf = (p) => workspaces.data?.find((w) => w.id === p.workspace)?.role;
  const wsName = workspaces.data?.find((w) => w.id === workspaceId)?.name;
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); projects.reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHeader title="Projects" description={wsName ? `In ${wsName}` : "Across all your workspaces"} actions={<Button onClick={() => setCreating(true)}><Plus />New project</Button>} />
      <Tabs value={status} onValueChange={setStatus} className="mb-4"><TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger></TabsList></Tabs>
      {projects.error ? <ErrorNote error={projects.error} retry={projects.reload} /> : projects.loading ? <ListSkeleton /> : !projects.data?.length ? (
        <EmptyState icon={FolderKanban} title={status === "active" ? "No projects yet" : "Nothing archived"} description={status === "active" ? "Create a project, import a Figma design and generate code." : "Archived projects appear here."} action={status === "active" && <Button onClick={() => setCreating(true)}><Plus />New project</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.data.map((p) => {
          const role = roleOf(p);
          return (
            <Card key={p.id} className="group relative transition-shadow hover:shadow-md"><CardContent className="space-y-3 p-5">
              <Link href={`/projects/${p.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${p.name}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="line-clamp-2 text-sm text-muted-foreground">{p.description || "No description"}</p></div>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative z-10 -mr-2 -mt-1 size-8" aria-label="Project actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {can(role, "project:update") && <DropdownMenuItem onClick={() => setRenaming(p)}><Pencil />Rename</DropdownMenuItem>}
                    {can(role, "project:create") && <DropdownMenuItem onClick={() => act(() => api.post(`/api/projects/${p.id}/duplicate`), "Project duplicated")}><Copy />Duplicate</DropdownMenuItem>}
                    {can(role, "project:archive") && <DropdownMenuItem onClick={() => act(() => api.patch(`/api/projects/${p.id}`, { status: status === "active" ? "archived" : "active" }), status === "active" ? "Archived" : "Restored")}>{status === "active" ? <><Archive />Archive</> : <><ArchiveRestore />Restore</>}</DropdownMenuItem>}
                    {can(role, "project:delete") && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="text-destructive" />Delete</DropdownMenuItem></>}
                  </DropdownMenuContent></DropdownMenu>
              </div>
              <div className="flex items-center justify-between"><div className="flex gap-1.5"><Badge variant="outline">{p.framework}</Badge><Badge variant="outline">{p.styling}</Badge></div><span className="text-xs text-muted-foreground">{timeAgo(p.updatedAt)}</span></div>
            </CardContent></Card>);
        })}</div>
      )}
      {creating && <ProjectDialog open onOpenChange={setCreating} workspaces={workspaces.data} defaultWorkspaceId={workspaceId} />}
      {renaming && <ProjectDialog open onOpenChange={() => setRenaming(null)} project={renaming} onDone={projects.reload} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} destructive title={`Delete "${deleting?.name}"?`} confirmLabel="Delete project" description="All imports and generated versions of this project are permanently removed."
        onConfirm={async () => { await api.del(`/api/projects/${deleting.id}`); toast.success("Project deleted"); projects.reload(); }} />
    </div>
  );
}
