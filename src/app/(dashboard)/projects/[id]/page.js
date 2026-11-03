"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Code2, FileImage, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/client-api";
import { can } from "@/lib/permissions";
import { ErrorNote, ListSkeleton, PageHeader, RoleBadge } from "@/components/layout/shared";
import { ImportPanel } from "@/components/figma/import-panel";
import { Inspector } from "@/components/figma/inspector";
import { GeneratePanel } from "@/components/project/generate-panel";
import { VersionHistory } from "@/components/project/history";

export default function ProjectPage({ params }) {
  const { id } = use(params);
  const proj = useApi(`/api/projects/${id}`);
  const me = useApi("/api/auth/me");
  const versions = useApi(`/api/projects/${id}/versions`);
  const [imp, setImp] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("design");
  const saveTimer = useRef();
  const p = proj.data?.project, role = proj.data?.role;
  useEffect(() => { if (p?.activeImport) api.get(`/api/figma/imports/${p.activeImport}`).then(setImp).catch(() => setImp(null)); }, [p?.activeImport]);
  useEffect(() => { if (p && selected === null) setSelected(p.selectedNodeIds || []); }, [p, selected]);
  const onSelect = (ids) => { setSelected(ids); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => api.patch(`/api/projects/${id}`, { selectedNodeIds: ids }).catch(() => {}), 600); };
  if (proj.error) return <ErrorNote error={proj.error} retry={proj.reload} />;
  if (!p) return <ListSkeleton rows={2} />;
  const canImport = can(role, "figma:import"), canGen = can(role, "code:generate");
  const isShot = imp?.sourceType === "screenshot";
  return (
    <div>
      <PageHeader title={p.name} description={p.description || `${proj.data.workspace.name}`}
        actions={<><RoleBadge role={role} /><Badge variant="outline">{p.framework}</Badge><Badge variant="outline">{p.styling}</Badge>{p.currentVersion > 0 && <Button asChild><Link href={`/studio/${p.id}`}><Code2 />Open Code Studio</Link></Button>}</>} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="design">Design</TabsTrigger><TabsTrigger value="generate">Convert</TabsTrigger><TabsTrigger value="history">History{versions.data?.length ? ` (${versions.data.length})` : ""}</TabsTrigger></TabsList>
        <TabsContent value="design" className="mt-5 space-y-6">
          {imp?.importStatus === "completed" && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>Source: <b className="text-foreground">{imp.sourceMetadata?.name || imp.sourceMetadata?.filename}</b> ({imp.sourceType}) · {imp.sourceMetadata?.nodeCount ?? 0} nodes</span>{selected?.length > 0 && <Button size="sm" onClick={() => setTab("generate")}>Convert {selected.length} selected →</Button>}</div>)}
          {imp?.warnings?.length > 0 && <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><summary className="flex cursor-pointer items-center gap-2"><Info className="size-4 text-amber-500" />{imp.warnings.length} import warning(s)</summary><ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-muted-foreground">{imp.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
          {imp && !isShot && <Inspector key={imp.id} importId={imp.id} selected={selected || []} onSelectedChange={onSelect} canEdit={canGen} />}
          {isShot && (
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileImage className="size-4" />Screenshot reference</CardTitle></CardHeader><CardContent className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/figma/imports/${imp.id}/screenshot`} alt="Uploaded design reference" className="max-h-[520px] rounded-lg border object-contain" />
              <p className="text-sm text-muted-foreground">{imp.sourceMetadata.width} × {imp.sourceMetadata.height}px · viewport {imp.sourceMetadata.viewport.width} × {imp.sourceMetadata.viewport.height}. This is a visual reference only; it cannot be converted to editable code.</p></CardContent></Card>)}
          {canImport ? (
            <Card><CardHeader><CardTitle className="text-base">{imp ? "Import a different design" : "Import a design"}</CardTitle></CardHeader><CardContent>
              <ImportPanel projectId={id} hasToken={!!me.data?.user?.hasFigmaToken} onImported={(i) => { setImp(i); setSelected([]); proj.reload(); }} /></CardContent></Card>
          ) : !imp && <p className="text-sm text-muted-foreground">No design has been imported yet. Editors and above can import.</p>}
        </TabsContent>
        <TabsContent value="generate" className="mt-5">
          <Card><CardContent className="p-5">
            {!imp ? <p className="text-sm text-muted-foreground">Import a design first.</p> : <GeneratePanel project={p} selected={selected || []} canGenerate={canGen} isScreenshot={isShot} onGenerated={() => { versions.reload(); proj.reload(); toast.success("Ready in Code Studio"); }} />}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="history" className="mt-5"><VersionHistory projectId={id} versions={versions.data} loading={versions.loading} canEdit={canGen} onChanged={() => { versions.reload(); proj.reload(); }} /></TabsContent>
      </Tabs>
    </div>
  );
}
