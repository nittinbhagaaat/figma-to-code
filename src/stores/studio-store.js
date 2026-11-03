"use client";
import { create } from "zustand";

/**
 * Code Studio state. `files` holds the server working copy; `buffers` holds unsaved edits.
 * Binary files are kept base64-encoded and are never editable.
 */
export const useStudioStore = create((set, get) => ({
  files: {}, // path -> { content, binary }
  buffers: {}, // path -> edited text
  tabs: [],
  active: null,
  load(list) {
    const files = {}; list.forEach((f) => (files[f.path] = { content: f.content, binary: f.binary }));
    const { tabs, active } = get();
    const keep = tabs.filter((t) => files[t]);
    const first = ["src/App.jsx", "app/page.js", "index.html"].find((p) => files[p]) || Object.keys(files).find((p) => !files[p].binary);
    set({ files, buffers: {}, tabs: keep.length ? keep : first ? [first] : [], active: keep.includes(active) ? active : keep[0] || first || null });
  },
  open(path) { const { tabs } = get(); set({ tabs: tabs.includes(path) ? tabs : [...tabs, path], active: path }); },
  close(path) {
    const { tabs, active } = get(); const i = tabs.indexOf(path); const next = tabs.filter((t) => t !== path);
    set({ tabs: next, active: active === path ? next[Math.max(0, i - 1)] ?? null : active });
  },
  edit(path, content) {
    const { files, buffers } = get();
    const next = { ...buffers };
    if (files[path]?.content === content) delete next[path]; else next[path] = content;
    set({ buffers: next });
  },
  markSaved(paths) {
    const { files, buffers } = get(); const f = { ...files }; const b = { ...buffers };
    paths.forEach((p) => { if (b[p] !== undefined) { f[p] = { ...f[p], content: b[p] }; delete b[p]; } });
    set({ files: f, buffers: b });
  },
  contentOf(path) { const { buffers, files } = get(); return buffers[path] ?? files[path]?.content ?? ""; },
}));
