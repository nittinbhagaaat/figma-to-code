"use client";
import { AlertTriangle, CheckCircle2, CircleSlash, ImageOff, Info } from "lucide-react";

const Group = ({ icon: Icon, tone, title, items, render }) => items?.length ? (
  <details className="rounded-lg border" open={title === "Unsupported features"}>
    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium"><Icon className={`size-4 ${tone}`} />{title}<span className="ml-auto text-xs text-muted-foreground">{items.length}</span></summary>
    <ul className="space-y-1 border-t px-3 py-2 text-xs">{items.slice(0, 200).map((x, i) => <li key={i} className="text-muted-foreground">{render(x)}</li>)}{items.length > 200 && <li>…and {items.length - 200} more</li>}</ul>
  </details>) : null;

export function ConversionReport({ report }) {
  if (!report?.summary) return <p className="text-sm text-muted-foreground">No report available.</p>;
  const s = report.summary;
  const nm = (x) => <><b className="text-foreground">{x.name}</b> <span className="font-mono">({x.type || x.id})</span></>;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[["Converted", s.converted, "text-success"], ["Skipped", s.skipped], ["Unsupported", s.unsupported], ["Approximated", s.approximations], ["Asset issues", s.assetFailures]].map(([k, v, c]) => <div key={k} className="rounded-lg border p-2.5"><p className={`text-lg font-semibold tabular-nums ${c || ""}`}>{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
      </div>
      {report.components?.length > 0 && <p className="text-xs text-muted-foreground">Components extracted: {report.components.map((c) => `${c.name}${c.instances > 1 ? ` ×${c.instances}` : ""}`).join(", ")}</p>}
      <Group icon={CircleSlash} tone="text-destructive" title="Unsupported features" items={report.unsupported} render={(x) => <>{nm(x)} — {x.feature}</>} />
      <Group icon={AlertTriangle} tone="text-amber-500" title="Approximations" items={report.approximations} render={(x) => <><b className="text-foreground">{x.name}</b> — {x.note}</>} />
      <Group icon={ImageOff} tone="text-amber-500" title="Asset extraction failures" items={report.assetFailures} render={(x) => <><b className="text-foreground">{x.name}</b> — {x.note}</>} />
      <Group icon={Info} tone="text-muted-foreground" title="Skipped nodes" items={report.skipped} render={(x) => <>{nm(x)} — {x.reason}</>} />
      <Group icon={Info} tone="text-muted-foreground" title="Notes" items={report.notes} render={(x) => x} />
      {!report.unsupported?.length && !report.assetFailures?.length && <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-success" />No unsupported features were encountered.</p>}
      <p className="text-xs text-muted-foreground">Output is deterministic but not guaranteed to be pixel-perfect. Review approximations above.</p>
    </div>
  );
}
