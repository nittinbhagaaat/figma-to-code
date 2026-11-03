"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, ChevronDown, ChevronRight, Component, Frame, Image as ImageIcon, Maximize, Minus, Plus, Shapes, Type, Layers, EyeOff, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { buildPreviewDoc, PREVIEW_SANDBOX } from "@/lib/preview/build-doc";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const FRAME_LIKE = new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION", "GROUP"]);
const iconFor = (t) => (t === "TEXT" ? Type : t === "COMPONENT" || t === "COMPONENT_SET" ? Component : t === "INSTANCE" ? Boxes : t === "FRAME" || t === "SECTION" ? Frame : t === "GROUP" ? Layers : t === "RECTANGLE" || t === "ELLIPSE" ? Shapes : ImageIcon);

function collectFrameIds(page) { return page.children.filter((c) => FRAME_LIKE.has(c.type) && c.visible !== false).map((c) => c.id); }
function topFrameOf(pages, id) {
  for (const p of pages) for (const f of p.children) { let found = f.id === id; const v = (n) => { if (n.id === id) found = true; n.children?.forEach(v); }; v(f); if (found) return f; }
  return null;
}
function findNode(pages, id) { let r = null; const v = (n) => { if (n.id === id) r = n; n.children?.forEach(v); }; pages.forEach(v); return r; }

function TreeNode({ node, depth, expanded, toggle, selected, toggleSelect, focus, onFocus, isRoot }) {
  const Icon = iconFor(node.type);
  const open = expanded.has(node.id);
  const has = node.children?.length > 0;
  return (
    <div>
      <div role="treeitem" aria-expanded={has ? open : undefined} aria-selected={focus === node.id} tabIndex={0}
        className={cn("group flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-sm hover:bg-accent", focus === node.id && "bg-accent", node.visible === false && "opacity-50")} style={{ paddingLeft: 4 + depth * 14 }}
        onClick={() => onFocus(node.id)} onKeyDown={(e) => { if (e.key === "Enter") onFocus(node.id); if (e.key === "ArrowRight" && has) toggle(node.id, true); if (e.key === "ArrowLeft") toggle(node.id, false); }}>
        <button className="grid size-5 shrink-0 place-items-center text-muted-foreground" aria-label={open ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); if (has) toggle(node.id); }}>{has ? (open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : null}</button>
        {isRoot && <Checkbox checked={selected.has(node.id)} onCheckedChange={() => toggleSelect(node.id)} onClick={(e) => e.stopPropagation()} aria-label={`Convert ${node.name}`} className="mr-1" />}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
        {node.visible === false && <EyeOff className="ml-auto size-3 shrink-0" />}
      </div>
      {open && has && node.children.map((c) => <TreeNode key={c.id} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} selected={selected} toggleSelect={toggleSelect} focus={focus} onFocus={onFocus} />)}
    </div>
  );
}

const Row = ({ k, v }) => v === undefined || v === null || v === "" ? null : <div className="flex items-start justify-between gap-3 py-1 text-xs"><span className="text-muted-foreground">{k}</span><span className="text-right font-mono">{v}</span></div>;
const Section = ({ title, children }) => { const kids = [].concat(children).filter(Boolean); return kids.length ? <div className="border-b p-3"><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{children}</div> : null; };
const hex = (c) => c && `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}${c.a != null && c.a < 1 ? ` · ${Math.round(c.a * 100)}%` : ""}`;
const r1 = (n) => (n === undefined ? undefined : Math.round(n * 100) / 100);
const Swatch = ({ p }) => p.type === "SOLID" ? <div className="flex items-center gap-2 py-0.5 text-xs"><span className="size-4 rounded border" style={{ background: hex(p.color)?.split(" ")[0] }} /><span className="font-mono">{hex(p.color)}</span>{p.visible === false && <Badge variant="outline">hidden</Badge>}</div> : <div className="py-0.5 text-xs font-mono">{p.type}{p.type === "IMAGE" ? ` (${p.scaleMode})` : ""}</div>;

function Props({ node }) {
  if (!node) return <p className="p-4 text-sm text-muted-foreground">Select a layer to inspect its properties.</p>;
  const L = node.layout, t = node.text?.style;
  return (
    <div>
      <div className="border-b p-3"><p className="truncate font-medium">{node.name}</p><div className="mt-1 flex gap-1.5"><Badge variant="secondary">{node.type}</Badge>{node.componentName && <Badge variant="outline">{node.componentName}</Badge>}</div></div>
      <Section title="Size & position"><Row k="Width" v={`${r1(node.width)} px`} /><Row k="Height" v={`${r1(node.height)} px`} /><Row k="X" v={r1(node.x)} /><Row k="Y" v={r1(node.y)} /><Row k="Rotation" v={node.rotation ? `${r1(node.rotation)}°` : undefined} /><Row k="Opacity" v={node.opacity < 1 ? `${Math.round(node.opacity * 100)}%` : undefined} /></Section>
      <Section title="Layout">{L ? <><Row k="Direction" v={L.mode.toLowerCase()} /><Row k="Gap" v={L.gap ? `${L.gap} px` : undefined} /><Row k="Padding" v={`${L.padding.top} ${L.padding.right} ${L.padding.bottom} ${L.padding.left}`} /><Row k="Primary align" v={L.primaryAlign} /><Row k="Counter align" v={L.counterAlign} /><Row k="Sizing" v={`${L.primarySizing === "AUTO" ? "hug" : "fixed"} / ${L.counterSizing === "AUTO" ? "hug" : "fixed"}`} /><Row k="Wrap" v={L.wrap ? "yes" : undefined} /></> : FRAME_LIKE.has(node.type) ? <Row k="Auto Layout" v="none (flow inferred or constraints)" /> : null}
        <Row k="Fills parent" v={node.childLayout?.grow ? "main axis" : node.childLayout?.align === "STRETCH" ? "cross axis" : undefined} /></Section>
      <Section title="Constraints">{node.constraints && <><Row k="Horizontal" v={node.constraints.horizontal} /><Row k="Vertical" v={node.constraints.vertical} /></>}</Section>
      <Section title="Fills">{node.fills?.map((p, i) => <Swatch key={i} p={p} />)}</Section>
      <Section title="Strokes">{node.strokes?.length ? <>{node.strokes.map((p, i) => <Swatch key={i} p={p} />)}<Row k="Weight" v={node.strokeWeight} /><Row k="Align" v={node.strokeAlign?.toLowerCase()} /></> : null}</Section>
      <Section title="Corner radius">{(node.cornerRadius || node.cornerRadii) && <Row k="Radius" v={node.cornerRadii ? node.cornerRadii.join(" ") : node.cornerRadius} />}</Section>
      <Section title="Typography">{t && <><Row k="Family" v={t.fontFamily} /><Row k="Size" v={t.fontSize} /><Row k="Weight" v={t.fontWeight ?? t.fontStyle} /><Row k="Line height" v={t.lineHeightPx && r1(t.lineHeightPx)} /><Row k="Letter spacing" v={t.letterSpacing || undefined} /><Row k="Align" v={t.textAlignHorizontal?.toLowerCase()} /><div className="mt-2 rounded-md bg-muted p-2 text-xs">{node.text.characters.slice(0, 200)}</div></>}</Section>
      <Section title="Effects">{node.effects?.length ? node.effects.map((e, i) => <Row key={i} k={e.type.replace(/_/g, " ").toLowerCase()} v={`${e.offset ? `${e.offset.x} ${e.offset.y} ` : ""}blur ${e.radius}`} />) : null}</Section>
    </div>
  );
}

export function Inspector({ importId, selected, onSelectedChange, canEdit }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [focus, setFocus] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [box, setBox] = useState(null);
  const [preview, setPreview] = useState({ loading: false, files: null, error: null, forId: null });
  useEffect(() => { api.get(`/api/figma/imports/${importId}/nodes`).then((d) => { setDoc(d); setPageId(d.pages[0]?.id || null); }).catch(setError); }, [importId]);
  const page = doc?.pages.find((p) => p.id === pageId);
  const sel = useMemo(() => new Set(selected), [selected]);
  const focusNode = useMemo(() => (doc && focus ? findNode(doc.pages, focus) : null), [doc, focus]);
  const frame = useMemo(() => (doc && focus ? topFrameOf(doc.pages, focus) : null), [doc, focus]);
  useEffect(() => { if (page && !focus && page.children[0]) setFocus(page.children[0].id); }, [page, focus]);
  useEffect(() => {
    if (!frame || !FRAME_LIKE.has(frame.type)) return;
    if (preview.forId === frame.id) return;
    let alive = true;
    setPreview({ loading: true, files: null, error: null, forId: frame.id });
    api.get(`/api/figma/imports/${importId}/preview?node=${encodeURIComponent(frame.id)}`).then((d) => alive && setPreview({ loading: false, files: d.files, error: null, forId: frame.id })).catch((e) => alive && setPreview({ loading: false, files: null, error: e, forId: frame.id }));
    return () => { alive = false; };
  }, [frame?.id, importId]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = useCallback((id, force) => setExpanded((s) => { const n = new Set(s); (force ?? !n.has(id)) ? n.add(id) : n.delete(id); return n; }), []);
  const toggleSelect = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); onSelectedChange([...n]); };
  const pageIds = page ? collectFrameIds(page) : [];
  const allSelected = pageIds.length > 0 && pageIds.every((i) => sel.has(i));
  const toggleAll = () => { const n = new Set(sel); allSelected ? pageIds.forEach((i) => n.delete(i)) : pageIds.forEach((i) => n.add(i)); onSelectedChange([...n]); };
  const srcDoc = useMemo(() => preview.files ? buildPreviewDoc({ files: preview.files, framework: "html", styling: "css", origin: window.location.origin }) : null, [preview.files]);
  const fitZoom = box && frame ? Math.min(1, (box.w - 32) / Math.max(frame.width, 1)) : 1;
  const z = fit ? fitZoom : zoom;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!doc) return <Skeleton className="h-[560px] rounded-xl" />;
  return (
    <div className="grid h-[640px] grid-cols-[260px_minmax(0,1fr)_280px] overflow-hidden rounded-xl border bg-card max-lg:grid-cols-[220px_minmax(0,1fr)] max-md:h-auto max-md:grid-cols-1">
      <div className="flex min-h-0 flex-col border-r max-md:h-72 max-md:border-b">
        <div className="space-y-2 border-b p-2">
          <select aria-label="Page" value={pageId || ""} onChange={(e) => { setPageId(e.target.value); setFocus(null); }} className="h-8 w-full rounded-md border bg-background px-2 text-sm">{doc.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {canEdit && <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Checkbox checked={allSelected} onCheckedChange={toggleAll} />Select all frames on page <span className="ml-auto">{pageIds.filter((i) => sel.has(i)).length}/{pageIds.length}</span></label>}
        </div>
        <ScrollArea className="min-h-0 flex-1"><div role="tree" className="p-1.5">
          {page?.children.length ? page.children.map((n) => <TreeNode key={n.id} node={n} depth={0} isRoot={canEdit && FRAME_LIKE.has(n.type)} expanded={expanded} toggle={toggle} selected={sel} toggleSelect={toggleSelect} focus={focus} onFocus={setFocus} />) : <p className="p-3 text-sm text-muted-foreground">This page has no layers.</p>}
        </div></ScrollArea>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs">
          <span className="truncate text-muted-foreground">{frame ? `${frame.name} — ${Math.round(frame.width)} × ${Math.round(frame.height)}` : "No frame"}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" aria-label="Zoom out" onClick={() => { setFit(false); setZoom(Math.max(0.1, (fit ? fitZoom : zoom) - 0.1)); }}><Minus className="size-3.5" /></Button>
            <span className="w-10 text-center tabular-nums">{Math.round(z * 100)}%</span>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Zoom in" onClick={() => { setFit(false); setZoom(Math.min(3, (fit ? fitZoom : zoom) + 0.1)); }}><Plus className="size-3.5" /></Button>
            <Button variant={fit ? "secondary" : "ghost"} size="sm" className="h-7 gap-1 px-2" onClick={() => setFit(true)}><Maximize className="size-3.5" />Fit</Button>
          </div>
        </div>
        <div ref={(el) => { if (el && (!box || Math.abs(box.w - el.clientWidth) > 2)) setBox({ w: el.clientWidth }); }} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-4 max-md:h-96">
          {preview.loading ? <Skeleton className="mx-auto h-96 w-full max-w-2xl" /> : preview.error ? <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="size-4" />{preview.error.message}</p> : srcDoc && frame ? (
            <div style={{ width: frame.width * z, height: frame.height * z }} className="mx-auto shrink-0 shadow-lg">
              <iframe title="Design preview" sandbox={PREVIEW_SANDBOX} srcDoc={srcDoc} className="block border-0 bg-white" style={{ width: frame.width, height: frame.height, transform: `scale(${z})`, transformOrigin: "top left" }} />
            </div>
          ) : <p className="text-sm text-muted-foreground">Select a frame to see it rendered.</p>}
        </div>
        {doc.unsupportedFeatures?.length > 0 && <div className="border-t bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">Source limitations: {doc.unsupportedFeatures.join(" · ")}</div>}
      </div>
      <ScrollArea className="min-h-0 border-l max-lg:hidden"><Props node={focusNode} /></ScrollArea>
    </div>
  );
}
