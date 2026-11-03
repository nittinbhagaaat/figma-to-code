"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, Building2, FileCode2, FolderKanban, GitBranch, Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { EmptyState, ErrorNote, PageHeader, RoleBadge, timeAgo } from "@/components/layout/shared";
import { ProjectDialog, WorkspaceDialog } from "@/components/layout/dialogs";
import { useWorkspaceStore } from "@/stores/workspace-store";

const Stat = ({ icon: Icon, label, value }) => (
  <Card><CardContent className="flex items-center gap-4 p-5"><div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>
);

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi("/api/dashboard");
  const { data: me } = useApi("/api/auth/me");
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const [wsOpen, setWsOpen] = useState(false);
  const [pOpen, setPOpen] = useState(false);
  if (error) return <ErrorNote error={error} retry={reload} />;
  const empty = data && data.stats.workspaces === 0;
  return (
    <div>
      <PageHeader title={`Welcome${me?.user ? `, ${me.user.name.split(" ")[0]}` : ""}`} description="Your designs, compiled to code."
        actions={<><Button variant="outline" onClick={() => setWsOpen(true)}><Building2 />New workspace</Button><Button onClick={() => setPOpen(true)} disabled={empty}><Plus />New project</Button></>} />
      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : empty ? (
        <EmptyState icon={Building2} title="Create your first workspace" description="A workspace holds your projects and teammates. Then import a Figma design and generate code." action={<Button onClick={() => setWsOpen(true)}><Plus />Create workspace</Button>} />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Building2} label="Workspaces" value={data.stats.workspaces} />
            <Stat icon={FolderKanban} label="Active projects" value={data.stats.projects} />
            <Stat icon={GitBranch} label="Conversions" value={data.stats.conversions} />
            <Stat icon={FileCode2} label="Generated files (latest versions)" value={data.stats.generatedFiles} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Recent projects</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/projects">View all</Link></Button></CardHeader>
              <CardContent>
                {data.recentProjects.length === 0 ? (
                  <EmptyState className="border-0 py-8" icon={UploadCloud} title="No projects yet" description="Create a project and import a Figma URL or .fig file." action={<Button onClick={() => setPOpen(true)}><Plus />New project</Button>} />
                ) : (
                  <ul className="divide-y">{data.recentProjects.map((p) => (
                    <li key={p.id}><Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                      <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-muted-foreground">Updated {timeAgo(p.updatedAt)}</p></div>
                      <div className="flex shrink-0 gap-1.5"><Badge variant="outline">{p.framework}</Badge><Badge variant="outline">{p.styling}</Badge></div>
                    </Link></li>))}</ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Workspaces</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.recentWorkspaces.map((w) => (
                  <Link key={w.id} href={`/workspaces/${w.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50"><div className="min-w-0"><p className="truncate text-sm font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.projectCount} projects · {w.memberCount} members</p></div><RoleBadge role={w.role} /></Link>))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Team activity</CardTitle></CardHeader>
            <CardContent>
              {data.activity.length === 0 ? <p className="text-sm text-muted-foreground">Activity from you and your teammates will show up here.</p> : (
                <ul className="space-y-3">{data.activity.map((a) => <li key={a.id} className="flex items-start justify-between gap-4 text-sm"><span>{a.message}</span><span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span></li>)}</ul>)}
            </CardContent>
          </Card>
        </div>
      )}
      {wsOpen && <WorkspaceDialog open onOpenChange={setWsOpen} onDone={reload} />}
      {pOpen && <ProjectDialog open onOpenChange={setPOpen} workspaces={data?.recentWorkspaces} defaultWorkspaceId={workspaceId} onDone={reload} />}
    </div>
  );
}
