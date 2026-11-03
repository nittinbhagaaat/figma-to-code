import { hashString } from "../utils/hash.js";
import { camelCase, componentName, createNamer, isGenericName, pascalCase } from "../utils/names.js";

/**
 * Deterministic component extraction.
 *  1. Structural signatures (tag, styles, structure — ignoring text content, image sources and placement)
 *     identify repeated subtrees, including Figma instances of the same component.
 *  2. Repeated subtrees become components; differing text/image values become props.
 *  3. Optionally, each top-level block of a page becomes its own section component.
 * No claim of perfect semantic recognition — only exact structural repetition is merged.
 */
export function extractComponents(pages, { sections = true, minInstances = 2 } = {}) {
  const namer = createNamer();
  const defs = []; // { name, template, instances:[comp nodes], props }
  const trees = () => [...pages.map((p) => p.ir), ...defs.map((d) => d.template)];

  for (let pass = 0; pass < 6; pass++) {
    const changed = repeatedPass(pages, defs, trees, namer, minInstances);
    if (!changed) break;
  }
  finalize(defs); // resolve props before section templates snapshot nested component usages
  if (sections) sectionPass(pages, defs, namer);
  return { defs, pages };
}

/* ---- signatures ---- */
function sig(node) {
  if (node.kind === "component") return (node.sig = `C:${node.ref.name}:${hashString(JSON.stringify(node.props || (node.slots || []).map((s) => s.value)))}`);
  const parts = [node.tag, node.kind, JSON.stringify(sortObj(node.css)), JSON.stringify(sortObj(node.media))];
  const { href: _href, ...attrs } = node.attrs || {};
  parts.push(JSON.stringify(attrs));
  if (node.text) parts.push(node.text.runs.map((r) => JSON.stringify(sortObj(r.css))).join("|"));
  if (node.kind === "image") parts.push("img");
  parts.push(node.children.map((c) => `${hashString(JSON.stringify(sortObj(c.place)) + JSON.stringify(sortObj(c.placeMedia)))}:${sig(c)}`).join(","));
  return (node.sig = hashString(parts.join("§")));
}
const sortObj = (o) => Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => (a < b ? -1 : 1)));

function walk(node, fn, parent = null, idx = 0) {
  fn(node, parent, idx);
  node.children.forEach((c, i) => walk(c, fn, node, i));
}

function repeatedPass(pages, defs, trees, namer, minInstances) {
  const roots = trees();
  roots.forEach(sig);
  const occ = new Map();
  roots.forEach((r) => walk(r, (n, parent, i) => {
    if (!parent || n.kind !== "box" || !n.children.length) return; // roots & leaves never componentize
    (occ.get(n.sig) || occ.set(n.sig, []).get(n.sig)).push({ node: n, parent, i });
  }));
  let changed = false;
  const done = new Set();
  const visit = (node, parent) => {
    if (parent && !parent.children.includes(node)) return; // detached by an earlier replacement in this pass
    if (parent && occ.get(node.sig)?.length >= minInstances && !done.has(node.sig) && node.kind === "box" && node.children.length) {
      done.add(node.sig);
      const list = occ.get(node.sig);
      const nm = nameFor(list.map((l) => l.node), namer);
      const def = { name: nm, template: cloneTemplate(list[0].node), sigKey: node.sig, instances: [] };
      defs.push(def);
      for (const { node: n, parent: p } of list) {
        const idx = p.children.indexOf(n);
        if (idx < 0) continue;
        const comp = { kind: "component", id: n.id, name: n.name, ref: def, place: n.place, placeMedia: n.placeMedia, slots: collectSlots(n), sig: `C:${nm}`, children: [], css: {}, media: {}, attrs: {}, originId: n.originId };
        p.children[idx] = comp;
        def.instances.push(comp);
      }
      changed = true;
      return; // do not descend; nested repeats are found on the next pass inside the template
    }
    [...node.children].forEach((c) => visit(c, node));
  };
  pages.forEach((p) => visit(p.ir, null));
  return changed;
}

function nameFor(nodes, namer) {
  const inst = nodes.find((n) => n.component);
  const raw = inst?.component || nodes[0].name;
  let base = componentName(raw, "");
  if (!base || isGenericName(raw)) base = guessName(nodes[0]);
  return namer(base);
}
function guessName(n) {
  if (n.tag === "button") return "Button";
  if (n.tag === "li") return "ListItem";
  if (n.tag === "nav") return "Nav";
  const hasImg = n.children.some((c) => c.kind === "image");
  const hasText = n.children.some((c) => c.kind === "text" || c.children?.length);
  if (hasImg && hasText && n.children.length >= 2) return "Card";
  return "Block";
}

function cloneTemplate(n) {
  const c = structuredCloneIR(n);
  c.place = {}; c.placeMedia = {};
  return c;
}
function structuredCloneIR(n) {
  if (n.kind === "component") {
    // nested component: keep the reference, snapshot its values, never deep-copy owners
    return { ...n, place: { ...n.place }, placeMedia: { ...n.placeMedia }, props: { ...(n.props || {}) }, slots: (n.slots || []).map((s) => ({ type: s.type, value: s.value, nested: true })), children: [] };
  }
  const { ref: _ref, ...rest } = n;
  const copy = JSON.parse(JSON.stringify({ ...rest, children: [] }));
  copy.children = n.children.map(structuredCloneIR);
  return copy;
}

/** Ordered list of variable slots (text runs and image sources) in a subtree, including slots of nested components. */
function collectSlots(root) {
  const slots = [];
  const rec = (n) => {
    if (n.kind === "component") { (n.slots || []).forEach((s) => slots.push({ type: s.type, value: s.value, nested: true })); return; }
    if (n.text) n.text.runs.forEach((r, i) => slots.push({ type: "text", value: r.text, owner: n, run: i }));
    if (n.kind === "image" && n.image) slots.push({ type: "image", value: n.image.src, owner: n });
    n.children.forEach(rec);
  };
  rec(root);
  return slots;
}

/** Decide props: a slot becomes a prop only if its value differs between instances. */
function finalize(defs) {
  for (const def of defs) {
    const templateSlots = collectSlots(def.template);
    const used = createNamer();
    def.props = [];
    templateSlots.forEach((slot, i) => {
      const values = def.instances.map((inst) => inst.slots[i]?.value);
      const varies = values.some((v) => v !== values[0]);
      if (!varies || slot.nested) return;
      let base = camelCase(slot.owner.name);
      if (!base || isGenericName(slot.owner.name)) base = slot.type === "image" ? "image" : "text";
      if (/^\d/.test(base)) base = "item" + pascalCase(base);
      const name = used(base).replace(/^(\w)(\d)$/, "$1$2");
      def.props.push({ name, type: slot.type, index: i, default: slot.value });
      if (slot.type === "text") slot.owner.text.runs[slot.run].prop = name;
      else slot.owner.image.prop = name;
    });
    for (const inst of def.instances) {
      inst.props = {};
      def.props.forEach((p) => { inst.props[p.name] = inst.slots[p.index]?.value; });
      delete inst.slots;
    }
  }
}

/** Each top-level block of a page becomes a section component named after its layer. */
function sectionPass(pages, defs, namer) {
  for (const page of pages) {
    const root = page.ir;
    const blocks = root.children.filter((c) => c.kind === "box" && c.children.length);
    if (blocks.length < 2 && !(blocks.length === 1 && root.children.length === 1 && blocks[0].children.length > 1)) continue;
    root.children = root.children.map((c, idx) => {
      if (c.kind !== "box" || !c.children.length) return c;
      const raw = c.name;
      let base = componentName(raw, "");
      if (!base || isGenericName(raw)) base = c.tag === "header" ? "Header" : c.tag === "footer" ? "Footer" : c.tag === "nav" ? "Nav" : `Section${idx + 1}`;
      const nm = namer(base);
      const def = { name: nm, template: cloneTemplate(c), sigKey: "section:" + c.id, instances: [], props: [], section: true };
      const comp = { kind: "component", id: c.id, name: c.name, ref: def, place: c.place, placeMedia: c.placeMedia, slots: [], props: {}, children: [], css: {}, media: {}, attrs: {}, originId: c.originId };
      def.instances.push(comp);
      defs.push(def);
      return comp;
    });
  }
}
