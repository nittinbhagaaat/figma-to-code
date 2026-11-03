"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client-api";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function WorkspaceDialog({ open, onOpenChange, workspace, onDone }) {
  const [name, setName] = useState(workspace?.name || "");
  const [description, setDescription] = useState(workspace?.description || "");
  const [busy, setBusy] = useState(false);
  const setWs = useWorkspaceStore((s) => s.setWorkspaceId);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const w = workspace ? await api.patch(`/api/workspaces/${workspace.id}`, { name, description }) : await api.post("/api/workspaces", { name, description });
      if (!workspace) setWs(w.id);
      toast.success(workspace ? "Workspace updated" : "Workspace created");
      onOpenChange(false); onDone?.(w);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>{workspace ? "Workspace settings" : "Create workspace"}</DialogTitle><DialogDescription>Workspaces group projects and the people who work on them.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="ws-name">Name</Label><Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="ws-desc">Description</Label><Textarea id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} /></div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin" />}{workspace ? "Save" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDialog({ open, onOpenChange, workspaces, defaultWorkspaceId, project, onDone, openAfter = true }) {
  const router = useRouter();
  const editable = workspaces?.filter((w) => w.role !== "viewer") || [];
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId && editable.some((w) => w.id === defaultWorkspaceId) ? defaultWorkspaceId : editable[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const p = project ? await api.patch(`/api/projects/${project.id}`, { name, description }) : await api.post("/api/projects", { workspaceId, name, description });
      toast.success(project ? "Project updated" : "Project created");
      onOpenChange(false); onDone?.(p);
      if (!project && openAfter) router.push(`/projects/${p.id}`);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>{project ? "Rename project" : "New project"}</DialogTitle><DialogDescription>{project ? "Update the project name and description." : "Create a project, then import a design into it."}</DialogDescription></DialogHeader>
          {!project && (editable.length === 0 ? <p className="text-sm text-destructive">You need Editor access to a workspace — create one first.</p> : (
            <div className="space-y-1.5"><Label>Workspace</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}><SelectTrigger className="w-full"><SelectValue placeholder="Select workspace" /></SelectTrigger><SelectContent>{editable.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
            </div>))}
          <div className="space-y-1.5"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} /></div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || (!project && !workspaceId)}>{busy && <Loader2 className="animate-spin" />}{project ? "Save" : "Create project"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
