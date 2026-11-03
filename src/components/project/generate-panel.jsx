"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/layout/shared";
import { api, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { ConversionReport } from "./report";

const FRAMEWORKS = [["html", "HTML / CSS / JS", "Static files, no build step"], ["react", "React", "Vite + components"], ["nextjs", "Next.js", "App Router + components"]];
const STYLINGS = [["css", "Plain CSS", "Variables, clean classes"], ["tailwind", "Tailwind CSS", "v4 utility classes"]];

const Choice = ({ options, value, onChange, name }) => (
  <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-3">
    {options.map(([v, label, hint]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-accent/50", value === v && "border-primary bg-primary/5 ring-1 ring-primary")}><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></button>)}
  </div>
);

export function GeneratePanel({ project, selected, onGenerated, canGenerate, isScreenshot }) {
  const router = useRouter();
  const [framework, setFramework] = useState(project.framework);
  const [styling, setStyling] = useState(project.styling);
  const [responsive, setResponsive] = useState(true);
  const [inferLayout, setInferLayout] = useState(true);
  const [componentize, setComponentize] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState(null);
  const generate = async (force = false) => {
    setBusy(true);
    try {
      const v = await api.post("/api/conversion/generate", { projectId: project.id, framework, styling, nodeIds: selected, force, options: { responsive, inferLayout, componentize } });
      setResult(v); onGenerated?.(v); toast.success(`Generated v${v.version} (${v.fileCount} files)`);
    } catch (e) { if (e instanceof ApiError && e.code === "DIRTY_WORKING_COPY") setDirty(true); else toast.error(e.message); } finally { setBusy(false); }
  };
  if (isScreenshot) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Screenshots are visual references only — import a Figma URL or .fig file to generate code.</p>;
  return (
    <div className="space-y-5">
      <div className="space-y-2"><Label>Framework</Label><Choice name="Framework" options={FRAMEWORKS} value={framework} onChange={setFramework} /></div>
      <div className="space-y-2"><Label>Styling</Label><Choice name="Styling" options={STYLINGS} value={styling} onChange={setStyling} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Responsive heuristics", responsive, setResponsive, "Stack rows and scale text on small screens"], ["Infer layout", inferLayout, setInferLayout, "Detect flow layout in frames without Auto Layout"], ["Extract components", componentize, setComponentize, "React/Next only"]].map(([l, v, set, h]) => (
          <label key={l} className="flex items-start gap-3 rounded-lg border p-3"><Switch checked={v} onCheckedChange={set} className="mt-0.5" /><span><span className="block text-sm font-medium">{l}</span><span className="text-xs text-muted-foreground">{h}</span></span></label>))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => generate(false)} disabled={busy || !canGenerate || selected.length === 0}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}Generate code</Button>
        <span className="text-sm text-muted-foreground">{selected.length ? `${selected.length} frame${selected.length > 1 ? "s" : ""} selected` : "Select at least one frame in the inspector"}</span>
        {project.currentVersion > 0 && <Button asChild variant="outline"><Link href={`/studio/${project.id}`}><Code2 />Open in Code Studio</Link></Button>}
      </div>
      {result && (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Version {result.version} generated</p><Button size="sm" onClick={() => router.push(`/studio/${project.id}`)}><Code2 />Open in Studio</Button></div>
          <ConversionReport report={result.conversionReport} />
        </div>)}
      <ConfirmDialog open={dirty} onOpenChange={setDirty} destructive title="Replace your manual edits?" confirmLabel="Regenerate anyway"
        description="Your Code Studio working copy has unsaved edits. Regenerating replaces them. Saved versions are never touched — save a version in the Studio first if you want to keep these edits."
        onConfirm={() => generate(true)} />
    </div>
  );
}
