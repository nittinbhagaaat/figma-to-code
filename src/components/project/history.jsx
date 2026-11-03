"use client";
import { useState } from "react";
import { Download, GitCompareArrows, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";
import { ConfirmDialog, EmptyState, ListSkeleton, timeAgo } from "@/components/layout/shared";
import { ConversionReport } from "./report";

const KIND = { generated: "Generated", saved: "Saved", restored: "Restored" };

export function VersionHistory({ projectId, versions, loading, canEdit, onChanged }) {
  const [restoring, setRestoring] = useState(null);
  const [report, setReport] = useState(null);
  const [cmp, setCmp] = useState([]);
  if (loading) return <ListSkeleton />;
  if (!versions?.length) return <EmptyState icon={History} title="No versions yet" description="Every generation and saved edit creates an immutable version you can restore or download." />;
  const toggleCmp = (v) => setCmp((c) => (c.includes(v.id) ? c.filter((x) => x !== v.id) : [...c.slice(-1), v.id]));
  const [a, b] = cmp.map((id) => versions.find((v) => v.id === id));
  return (
    <div className="space-y-4">
      {a && b && (
        <div className="rounded-xl border p-4 text-sm"><p className="mb-2 flex items-center gap-2 font-medium"><GitCompareArrows className="size-4" />Comparing v{a.version} ↔ v{b.version}</p>
          <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="py-1 font-normal"></th><th className="font-normal">v{a.version}</th><th className="font-normal">v{b.version}</th></tr></thead><tbody>
            {[["Framework", (v) => v.framework], ["Styling", (v) => v.styling], ["Files", (v) => v.fileCount], ["Kind", (v) => KIND[v.kind]], ["Created", (v) => new Date(v.createdAt).toLocaleString()], ["Frames", (v) => v.config?.nodeIds?.length ?? "—"]].map(([k, f]) => <tr key={k} className="border-t"><td className="py-1.5 text-muted-foreground">{k}</td><td className={f(a) !== f(b) ? "font-medium" : ""}>{f(a)}</td><td className={f(a) !== f(b) ? "font-medium" : ""}>{f(b)}</td></tr>)}
          </tbody></table></div>)}
      <div className="divide-y rounded-xl border">{versions.map((v, i) => (
        <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium">v{v.version}{i === 0 && <Badge>latest</Badge>}<Badge variant="outline">{KIND[v.kind]}</Badge>{v.label && <span className="truncate font-normal text-muted-foreground">{v.label}</span>}</p>
            <p className="text-xs text-muted-foreground">{v.framework} · {v.styling} · {v.fileCount} files · {timeAgo(v.createdAt)}</p></div>
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-1.5 pr-2 text-xs text-muted-foreground"><input type="checkbox" checked={cmp.includes(v.id)} onChange={() => toggleCmp(v)} aria-label={`Compare v${v.version}`} />Compare</label>
            {v.kind === "generated" && <Button variant="ghost" size="sm" onClick={async () => setReport((await api.get(`/api/conversion/${v.id}/report`)).report)}>Report</Button>}
            <Button asChild variant="ghost" size="sm"><a href={`/api/projects/${projectId}/export?versionId=${v.id}`}><Download />ZIP</a></Button>
            {canEdit && i > 0 && <Button variant="outline" size="sm" onClick={() => setRestoring(v)}><RotateCcw />Restore</Button>}
          </div></div>))}</div>
      <ConfirmDialog open={!!restoring} onOpenChange={(o) => !o && setRestoring(null)} title={`Restore v${restoring?.version}?`} confirmLabel="Restore"
        description="This creates a new version from the old files and replaces your working copy. History is never rewritten." onConfirm={async () => { await api.post(`/api/projects/${projectId}/restore`, { versionId: restoring.id }); toast.success("Version restored"); onChanged(); }} />
      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Conversion report</DialogTitle><DialogDescription>What was converted, approximated or skipped.</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto">{report && <ConversionReport report={report} />}</div></DialogContent></Dialog>
    </div>
  );
}
