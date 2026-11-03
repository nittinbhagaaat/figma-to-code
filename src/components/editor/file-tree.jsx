"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, File, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

function build(paths) {
  const root = { name: "", children: new Map(), path: "" };
  for (const p of paths) {
    let n = root; const parts = p.split("/");
    parts.forEach((part, i) => {
      if (!n.children.has(part)) n.children.set(part, { name: part, children: new Map(), path: parts.slice(0, i + 1).join("/"), file: i === parts.length - 1 });
      n = n.children.get(part);
    });
  }
  return root;
}
const sortKids = (n) => [...n.children.values()].sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file ? 1 : -1));
const iconFor = (name) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(name) ? FileImage : /\.jsx?$|\.html$|\.css$/.test(name) ? FileCode2 : /\.json$/.test(name) ? FileJson : /\.md$/.test(name) ? FileText : File;

function Node({ node, depth, open, toggle, active, onOpen, dirty }) {
  if (node.file) {
    const Icon = iconFor(node.name);
    return <button onClick={() => onOpen(node.path)} className={cn("flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] hover:bg-accent", active === node.path && "bg-accent font-medium")} style={{ paddingLeft: 8 + depth * 12 }}><Icon className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{node.name}</span>{dirty.has(node.path) && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary" aria-label="unsaved" />}</button>;
  }
  const isOpen = open.has(node.path);
  return (
    <div>
      <button onClick={() => toggle(node.path)} className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[13px] hover:bg-accent" style={{ paddingLeft: 4 + depth * 12 }} aria-expanded={isOpen}>
        {isOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}{isOpen ? <FolderOpen className="size-3.5 shrink-0 text-primary" /> : <Folder className="size-3.5 shrink-0 text-primary" />}<span className="truncate">{node.name}</span>
      </button>
      {isOpen && sortKids(node).map((c) => <Node key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} active={active} onOpen={onOpen} dirty={dirty} />)}
    </div>
  );
}

export function FileTree({ paths, active, onOpen, dirty }) {
  const tree = useMemo(() => build(paths), [paths]);
  const [open, setOpen] = useState(() => new Set(["src", "app", "components", "src/components", "css", "js"]));
  const toggle = (p) => setOpen((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  return <div role="tree" aria-label="Project files" className="p-1">{sortKids(tree).map((n) => <Node key={n.path} node={n} depth={0} open={open} toggle={toggle} active={active} onOpen={onOpen} dirty={dirty} />)}</div>;
}
