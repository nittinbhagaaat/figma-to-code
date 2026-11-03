"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader, RoleBadge } from "@/components/layout/shared";
import { WorkspaceDialog } from "@/components/layout/dialogs";

export default function WorkspacesPage() {
  const { data, error, loading, reload } = useApi("/api/workspaces");
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader title="Workspaces" description="Switch between teams and manage who has access." actions={<Button onClick={() => setOpen(true)}><Plus />New workspace</Button>} />
      {error ? <ErrorNote error={error} retry={reload} /> : loading ? <ListSkeleton /> : !data.length ? (
        <EmptyState icon={Building2} title="No workspaces yet" description="Create one to start organising projects and inviting teammates." action={<Button onClick={() => setOpen(true)}><Plus />Create workspace</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((w) => (
            <Link key={w.id} href={`/workspaces/${w.id}`}><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2"><div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{w.name[0]?.toUpperCase()}</div><RoleBadge role={w.role} /></div>
              <div><p className="font-medium">{w.name}</p><p className="line-clamp-2 text-sm text-muted-foreground">{w.description || "No description"}</p></div>
              <p className="text-xs text-muted-foreground">{w.projectCount} projects · {w.memberCount} members</p>
            </CardContent></Card></Link>))}
        </div>
      )}
      {open && <WorkspaceDialog open onOpenChange={setOpen} onDone={reload} />}
    </div>
  );
}
