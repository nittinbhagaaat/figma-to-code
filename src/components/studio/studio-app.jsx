"use client";
/* eslint-disable @next/next/no-img-element -- previews of in-memory data URLs; next/image does not apply */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, FileDown, Loader2, Monitor, RefreshCw, Save, Search, Smartphone, Sparkles, Tablet, TerminalSquare, X, History, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeEditor } from "@/components/editor/code-editor";
import { FileTree } from "@/components/editor/file-tree";
import { PreviewFrame, VIEWPORTS } from "@/components/preview/preview-frame";
import { ConversionReport } from "@/components/project/report";
import { VersionHistory } from "@/components/project/history";
import { ThemeToggle } from "@/components/layout/app-shell";
import { ConfirmDialog, ErrorNote } from "@/components/layout/shared";
import { useStudioStore } from "@/stores/studio-store";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const vpIcons = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export function StudioApp({ projectId }) {
  const proj = useApi(`/api/projects/${projectId}`);
  const versions = useApi(`/api/projects/${projectId}/versions`);
  const { files, buffers, tabs, active, load, open, close, edit, markSaved } = useStudioStore();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [viewport, setViewport] = useState("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState("index.html");
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [reveal, setReveal] = useState(null);
  const [panel, setPanel] = useState("console");
  const [report, setReport] = useState(null);

  const p = proj.data?.project, role = proj.data?.role;
  const canEdit = can(role, "code:edit");
  const dirtyPaths = useMemo(() => new Set(Object.keys(buffers)), [buffers]);

  const reloadFiles = useCallback(async () => {
    try { const wc = await api.get(`/api/projects/${projectId}/files`); load(wc.files); setLoaded(true); setReloadKey((k) => k + 1); } catch (e) { setLoadError(e); }
  }, [projectId, load]);
  useEffect(() => { reloadFiles(); }, [reloadFiles]);
  useEffect(() => {
    const latest = versions.data?.find((v) => v.kind === "generated");
    if (latest) api.get(`/api/conversion/${latest.id}/report`).then((r) => setReport(r.report)).catch(() => {});
  }, [versions.data]);

  // Live preview: saved files are used immediately; unsaved edits are folded in after a short debounce.
  const [liveBuffers, setLiveBuffers] = useState({});
  useEffect(() => { const t = setTimeout(() => setLiveBuffers(buffers), 500); return () => clearTimeout(t); }, [buffers]);
  const previewFiles = useMemo(() => Object.entries(files).map(([path, f]) => ({ path, binary: f.binary, content: liveBuffers[path] ?? f.content })), [files, liveBuffers]);

  const onPreviewMessage = useCallback((m) => {
    if (m.type === "console" || m.type === "error") { setLogs((l) => [...l.slice(-199), { level: m.type === "error" ? "error" : m.level, text: m.message || m.text, at: new Date() }]); if (m.type === "error") setPanel("console"); }
    if (m.type === "ready") setLogs((l) => [...l.slice(-199), { level: "info", text: "Preview ready", at: new Date() }]);
  }, []);

  const save = useCallback(async () => {
    const changed = Object.entries(useStudioStore.getState().buffers);
    if (!changed.length || !canEdit) return;
    setSaving(true);
    try { await api.put(`/api/projects/${projectId}/files`, { changes: changed.map(([path, content]) => ({ path, content })) }); markSaved(changed.map(([p]) => p)); toast.success(`Saved ${changed.length} file${changed.length > 1 ? "s" : ""}`); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }, [projectId, canEdit, markSaved]);

  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } };
    const warn = (e) => { if (Object.keys(useStudioStore.getState().buffers).length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", h); window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("keydown", h); window.removeEventListener("beforeunload", warn); };
  }, [save]);

  const saveVersion = async () => {
    try { await save(); const v = await api.post(`/api/projects/${projectId}/versions`, { label }); toast.success(`Saved as v${v.version}`); setSaveVersionOpen(false); setLabel(""); versions.reload(); proj.reload(); } catch (e) { toast.error(e.message); }
  };
  const download = (path) => {
    const f = files[path]; const content = buffers[path] ?? f.content;
    const blob = f.binary ? new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))]) : new Blob([content], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = path.split("/").pop(); a.click(); URL.revokeObjectURL(a.href);
  };
  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase(); const out = [];
    for (const [path, f] of Object.entries(files)) {
      if (f.binary) continue;
      (buffers[path] ?? f.content).split("\n").forEach((line, i) => { if (out.length < 200 && line.toLowerCase().includes(q)) out.push({ path, line: i + 1, text: line.trim().slice(0, 140) }); });
    }
    return out;
  }, [query, files, buffers]);

  const htmlPages = useMemo(() => Object.keys(files).filter((f) => /^[^/]+\.html$/.test(f)), [files]);
  const activeFile = active ? files[active] : null;

  if (proj.error || loadError) return <div className="p-8"><ErrorNote error={proj.error || loadError} /></div>;
  if (!p || !loaded) return <div className="grid h-screen grid-rows-[48px_1fr] gap-0"><Skeleton className="rounded-none" /><Skeleton className="rounded-none" /></div>;
  if (!Object.keys(files).length) return (
    <div className="grid h-screen place-items-center p-6 text-center"><div className="max-w-sm space-y-4"><h1 className="text-xl font-semibold">No generated code yet</h1><p className="text-sm text-muted-foreground">Import a design and generate code first.</p><Button asChild><Link href={`/projects/${projectId}`}>Back to project</Link></Button></div></div>);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <Tooltip><TooltipTrigger asChild><Button asChild variant="ghost" size="icon"><Link href={`/projects/${projectId}`} aria-label="Back to project"><ArrowLeft className="size-4" /></Link></Button></TooltipTrigger><TooltipContent>Back to project</TooltipContent></Tooltip>
        <span className="max-w-48 truncate text-sm font-medium">{p.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{p.framework} · {p.styling} · v{p.currentVersion}{dirtyPaths.size ? " · unsaved" : p.workingCopyDirty ? " · edited" : ""}</span>
        <div className="mx-auto hidden items-center gap-0.5 rounded-lg border p-0.5 md:flex" role="group" aria-label="Preview viewport">
          {Object.entries(VIEWPORTS).map(([k, v]) => { const I = vpIcons[k]; return <Tooltip key={k}><TooltipTrigger asChild><Button variant={viewport === k ? "secondary" : "ghost"} size="icon" className="size-7" aria-pressed={viewport === k} aria-label={`${v.label} preview`} onClick={() => setViewport(k)}><I className="size-3.5" /></Button></TooltipTrigger><TooltipContent>{v.label} ({v.width}px)</TooltipContent></Tooltip>; })}
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}><History />History</Button>
          {canEdit && <Button variant="ghost" size="sm" onClick={() => setRegen(true)}><Sparkles />Regenerate</Button>}
          {canEdit && <Button variant="outline" size="sm" onClick={save} disabled={saving || !dirtyPaths.size}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save</Button>}
          {canEdit && <Button size="sm" onClick={() => setSaveVersionOpen(true)}>Save version</Button>}
          <Button asChild variant="outline" size="sm"><a href={`/api/projects/${projectId}/export`}><Download />ZIP</a></Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)] max-lg:grid-cols-[200px_minmax(0,1fr)] max-md:grid-cols-1 max-md:grid-rows-[200px_1fr_320px]">
        <aside className="flex min-h-0 flex-col border-r">
          <div className="border-b p-2"><div className="relative"><Search className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in files" aria-label="Search in files" className="h-8 pl-7 text-xs" /></div></div>
          <ScrollArea className="min-h-0 flex-1">
            {query.trim().length >= 2 ? (
              <div className="p-1 text-xs">{results.length === 0 ? <p className="p-3 text-muted-foreground">No matches</p> : results.map((r, i) => <button key={i} className="block w-full rounded px-2 py-1 text-left hover:bg-accent" onClick={() => { open(r.path); setReveal({ path: r.path, line: r.line }); }}><span className="font-medium">{r.path.split("/").pop()}</span><span className="text-muted-foreground">:{r.line}</span><span className="block truncate font-mono text-muted-foreground">{r.text}</span></button>)}</div>
            ) : <FileTree paths={Object.keys(files).sort()} active={active} onOpen={open} dirty={dirtyPaths} />}
          </ScrollArea>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col border-r">
          <div role="tablist" className="flex h-9 shrink-0 items-end overflow-x-auto border-b bg-muted/30">
            {tabs.map((t) => (
              <div key={t} role="tab" aria-selected={active === t} className={cn("group flex h-9 shrink-0 cursor-pointer items-center gap-2 border-r px-3 text-xs", active === t ? "bg-background font-medium" : "text-muted-foreground hover:bg-accent/50")} onClick={() => open(t)}>
                <span>{t.split("/").pop()}</span>{dirtyPaths.has(t) ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                <button aria-label={`Close ${t}`} className="rounded p-0.5 hover:bg-accent" onClick={(e) => { e.stopPropagation(); close(t); }}><X className="size-3" /></button>
              </div>))}
            {active && <div className="ml-auto flex shrink-0 items-center gap-0.5 px-1 pb-1">
              {!activeFile?.binary && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="Copy code" onClick={() => { navigator.clipboard.writeText(buffers[active] ?? activeFile.content); toast.success("Copied"); }}><Copy className="size-3.5" /></Button></TooltipTrigger><TooltipContent>Copy code</TooltipContent></Tooltip>}
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="Download file" onClick={() => download(active)}><FileDown className="size-3.5" /></Button></TooltipTrigger><TooltipContent>Download file</TooltipContent></Tooltip>
            </div>}
          </div>
          <div className="min-h-0 flex-1">
            {!active ? <div className="grid h-full place-items-center text-sm text-muted-foreground">Open a file from the explorer</div>
              : activeFile?.binary ? <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground"><div>{/\.(png|jpe?g|webp|gif)$/i.test(active) ? <img alt={active} src={`data:image/${active.split(".").pop()};base64,${activeFile.content}`} className="mx-auto mb-3 max-h-64 rounded border" /> : null}Binary file — download it to view or replace.</div></div>
              : <CodeEditor key={active} path={active} value={buffers[active] ?? activeFile.content} readOnly={!canEdit} onChange={(v) => edit(active, v)} onSave={save} reveal={reveal?.path === active ? reveal.line : null} />}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col max-lg:hidden">
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-2 text-xs">
            <span className="text-muted-foreground">Live preview · sandboxed</span>
            <div className="flex items-center gap-1">
              {p.framework === "html" && htmlPages.length > 1 && <Select value={page} onValueChange={setPage}><SelectTrigger className="h-7 w-32 text-xs" aria-label="Preview page"><SelectValue /></SelectTrigger><SelectContent>{htmlPages.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select>}
              <Button variant="ghost" size="icon" className="size-7" aria-label="Refresh preview" onClick={() => { setLogs([]); setReloadKey((k) => k + 1); }}><RefreshCw className="size-3.5" /></Button>
            </div>
          </div>
          <div className="min-h-0 flex-1"><PreviewFrame files={previewFiles} framework={p.framework} styling={p.styling} page={page} viewport={viewport} reloadKey={reloadKey} onMessage={onPreviewMessage} /></div>
        </section>
      </div>

      <div className="h-48 shrink-0 border-t max-md:hidden">
        <Tabs value={panel} onValueChange={setPanel} className="h-full gap-0">
          <div className="flex items-center justify-between border-b px-2"><TabsList className="h-9 bg-transparent p-0"><TabsTrigger value="console" className="gap-1.5 text-xs"><TerminalSquare className="size-3.5" />Console{logs.some((l) => l.level === "error") && <span className="size-1.5 rounded-full bg-destructive" />}</TabsTrigger><TabsTrigger value="report" className="gap-1.5 text-xs"><AlertTriangle className="size-3.5" />Conversion report{report?.summary && <span className="text-muted-foreground">({report.summary.approximations + report.summary.unsupported + report.summary.skipped})</span>}</TabsTrigger></TabsList>
            {panel === "console" && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLogs([])}>Clear</Button>}</div>
          <TabsContent value="console" className="m-0 min-h-0 flex-1"><ScrollArea className="h-[136px]"><div className="space-y-0.5 p-2 font-mono text-xs">{logs.length === 0 ? <p className="text-muted-foreground">Preview output, runtime errors and build errors appear here.</p> : logs.map((l, i) => <p key={i} className={cn(l.level === "error" && "text-destructive", l.level === "warn" && "text-amber-500", l.level === "info" && "text-muted-foreground")}>{l.text}</p>)}</div></ScrollArea></TabsContent>
          <TabsContent value="report" className="m-0 min-h-0 flex-1"><ScrollArea className="h-[136px]"><div className="p-3"><ConversionReport report={report} /></div></ScrollArea></TabsContent>
        </Tabs>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Version history</DialogTitle><DialogDescription>Versions are immutable. Restoring creates a new version.</DialogDescription></DialogHeader><div className="max-h-[65vh] overflow-y-auto"><VersionHistory projectId={projectId} versions={versions.data} loading={versions.loading} canEdit={canEdit} onChanged={() => { setHistoryOpen(false); versions.reload(); proj.reload(); reloadFiles(); }} /></div></DialogContent></Dialog>
      <Dialog open={saveVersionOpen} onOpenChange={setSaveVersionOpen}><DialogContent><DialogHeader><DialogTitle>Save version</DialogTitle><DialogDescription>Snapshots your current edits as a new immutable version.</DialogDescription></DialogHeader><div className="space-y-1.5"><Label htmlFor="vl">Label (optional)</Label><Input id="vl" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="e.g. Tweaked hero spacing" /></div><DialogFooter><Button variant="ghost" onClick={() => setSaveVersionOpen(false)}>Cancel</Button><Button onClick={saveVersion}>Save version</Button></DialogFooter></DialogContent></Dialog>
      {regen && <RegenerateDialog project={p} dirty={dirtyPaths.size > 0 || p.workingCopyDirty} onClose={() => setRegen(false)} onDone={() => { setRegen(false); proj.reload(); versions.reload(); reloadFiles(); }} />}
    </div>
  );
}

function RegenerateDialog({ project, dirty, onClose, onDone }) {
  const [framework, setFramework] = useState(project.framework);
  const [styling, setStyling] = useState(project.styling);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const v = await api.post("/api/conversion/generate", { projectId: project.id, framework, styling, nodeIds: project.selectedNodeIds, force: true }); toast.success(`Generated v${v.version}`); onDone(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Regeneration failed"); } finally { setBusy(false); }
  };
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent>
        <DialogHeader><DialogTitle>Regenerate code</DialogTitle><DialogDescription>Re-runs the compiler on the {project.selectedNodeIds.length} selected frame(s). A new version is created; older versions stay untouched.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Framework</Label><Select value={framework} onValueChange={setFramework}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="html">HTML/CSS/JS</SelectItem><SelectItem value="react">React</SelectItem><SelectItem value="nextjs">Next.js</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Styling</Label><Select value={styling} onValueChange={setStyling}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="css">Plain CSS</SelectItem><SelectItem value="tailwind">Tailwind CSS</SelectItem></SelectContent></Select></div>
        </div>
        {dirty && <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />You have manual edits. Regenerating replaces your working copy (saved versions are kept). Use “Save version” first to keep them.</p>}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => (dirty ? setConfirm(true) : run())}>{busy && <Loader2 className="animate-spin" />}Regenerate</Button></DialogFooter>
      </DialogContent></Dialog>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} destructive title="Replace manual edits?" confirmLabel="Replace" description="Your unsaved changes and working-copy edits will be overwritten by the regenerated code." onConfirm={run} />
    </>
  );
}
