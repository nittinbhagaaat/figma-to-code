/**
 * Maps CSS declarations (the single source of truth produced by the IR builder) to Tailwind v4 utility classes.
 * Common properties map to first-class utilities; anything else falls back to Tailwind's arbitrary-property
 * syntax (`[prop:value]`), so no declaration is ever dropped.
 */
const WEIGHTS = { 100: "thin", 200: "extralight", 300: "light", 400: "normal", 500: "medium", 600: "semibold", 700: "bold", 800: "extrabold", 900: "black" };
const ITEMS = { "flex-start": "start", center: "center", "flex-end": "end", stretch: "stretch", baseline: "baseline" };
const JUSTIFY = { "flex-start": "start", center: "center", "flex-end": "end", "space-between": "between", "space-around": "around", "space-evenly": "evenly" };

const esc = (v) => String(v).trim().replace(/\s+/g, "_");
const arb = (prop, value) => `[${prop}:${esc(value)}]`;

function spacing(value) {
  if (value === "0" || value === "0px") return "0";
  const m = /^(-?)(\d+(?:\.\d+)?)px$/.exec(value);
  if (!m) return null;
  const n = Number(m[2]);
  if (n === 1) return `${m[1]}px`;
  if (n % 2 === 0 || n === 0) return `${m[1]}${n / 4}`;
  return null;
}
const lenOrArb = (value, scaleFn) => scaleFn(value) ?? `[${esc(value)}]`;

function sizeClass(prefix, value) {
  if (value === "100%") return `${prefix}-full`;
  if (value === "fit-content") return `${prefix}-fit`;
  if (value === "auto") return `${prefix}-auto`;
  const s = spacing(value);
  return s != null ? `${prefix}-${s}` : `${prefix}-[${esc(value)}]`;
}

function boxShorthand(prefix, value) {
  const parts = String(value).trim().split(/\s+/);
  const [t, r = t, b = t, l = r] = parts;
  const one = (p, v) => `${p}-${lenOrArb(v, spacing)}`;
  if (t === r && r === b && b === l) return [one(prefix, t)];
  if (t === b && r === l) return [one(`${prefix}y`, t), one(`${prefix}x`, r)].filter((c) => !/-0$/.test(c));
  return [one(`${prefix}t`, t), one(`${prefix}r`, r), one(`${prefix}b`, b), one(`${prefix}l`, l)].filter((c) => !/-0$/.test(c));
}

export function declarationToClasses(prop, value) {
  const v = String(value);
  switch (prop) {
    case "display": return [{ flex: "flex", block: "block", grid: "grid", "inline-flex": "inline-flex", inline: "inline", "inline-block": "inline-block", none: "hidden" }[v] || arb(prop, v)];
    case "position": return [{ absolute: "absolute", relative: "relative", fixed: "fixed", sticky: "sticky" }[v] || arb(prop, v)];
    case "flex-direction": return [{ column: "flex-col", row: "flex-row", "row-reverse": "flex-row-reverse", "column-reverse": "flex-col-reverse" }[v] || arb(prop, v)];
    case "flex-wrap": return [v === "wrap" ? "flex-wrap" : v === "nowrap" ? "flex-nowrap" : arb(prop, v)];
    case "align-items": return [ITEMS[v] ? `items-${ITEMS[v]}` : arb(prop, v)];
    case "align-self": return [ITEMS[v] ? `self-${ITEMS[v]}` : v === "auto" ? "self-auto" : arb(prop, v)];
    case "justify-content": return [JUSTIFY[v] ? `justify-${JUSTIFY[v]}` : arb(prop, v)];
    case "gap": case "row-gap": case "column-gap": {
      const p = prop === "gap" ? "gap" : prop === "row-gap" ? "gap-y" : "gap-x";
      return [`${p}-${lenOrArb(v, spacing)}`];
    }
    case "flex": return [v === "1 1 0" || v === "1 1 0%" ? "flex-1" : v === "none" ? "flex-none" : v === "1 1 auto" ? "flex-auto" : arb(prop, v)];
    case "flex-shrink": return [v === "0" ? "shrink-0" : v === "1" ? "shrink" : arb(prop, v)];
    case "flex-grow": return [v === "1" ? "grow" : v === "0" ? "grow-0" : arb(prop, v)];
    case "width": return [sizeClass("w", v)];
    case "height": return [sizeClass("h", v)];
    case "min-width": return [sizeClass("min-w", v)];
    case "min-height": return [sizeClass("min-h", v)];
    case "max-width": return [sizeClass("max-w", v)];
    case "max-height": return [sizeClass("max-h", v)];
    case "left": case "right": case "top": case "bottom": {
      if (v === "50%") return [`${prop}-1/2`];
      if (v === "0" || v === "0px") return [`${prop}-0`];
      if (v === "100%") return [`${prop}-full`];
      return [`${prop}-${lenOrArb(v, spacing)}`];
    }
    case "padding": return boxShorthand("p", v);
    case "margin": return v === "0 auto" ? ["mx-auto"] : boxShorthand("m", v);
    case "margin-left": return [v === "auto" ? "ml-auto" : `ml-${lenOrArb(v, spacing)}`];
    case "margin-right": return [v === "auto" ? "mr-auto" : `mr-${lenOrArb(v, spacing)}`];
    case "margin-top": return [`mt-${lenOrArb(v, spacing)}`];
    case "margin-bottom": return [`mb-${lenOrArb(v, spacing)}`];
    case "overflow": return [{ hidden: "overflow-hidden", auto: "overflow-auto", visible: "overflow-visible" }[v] || arb(prop, v)];
    case "box-sizing": return [v === "border-box" ? "box-border" : "box-content"];
    case "border-radius": return [v === "50%" ? "rounded-full" : `rounded-[${esc(v)}]`];
    case "opacity": { const n = Math.round(Number(v) * 100); return [n === Number(v) * 100 && n % 5 === 0 ? `opacity-${n}` : `opacity-[${v}]`]; }
    case "background-color": return [`bg-[${esc(v)}]`];
    case "color": return [`text-[${esc(v)}]`];
    case "font-size": return [`text-[${esc(v)}]`];
    case "font-weight": return [WEIGHTS[v] ? `font-${WEIGHTS[v]}` : `font-[${v}]`];
    case "font-style": return [v === "italic" ? "italic" : arb(prop, v)];
    case "line-height": return [`leading-[${esc(v)}]`];
    case "letter-spacing": return [`tracking-[${esc(v)}]`];
    case "text-align": return [{ left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" }[v] || arb(prop, v)];
    case "text-transform": return [{ uppercase: "uppercase", lowercase: "lowercase", capitalize: "capitalize" }[v] || arb(prop, v)];
    case "text-decoration": return [{ underline: "underline", "line-through": "line-through", none: "no-underline" }[v] || arb(prop, v)];
    case "white-space": return [{ nowrap: "whitespace-nowrap", pre: "whitespace-pre", "pre-wrap": "whitespace-pre-wrap" }[v] || arb(prop, v)];
    case "object-fit": return [{ cover: "object-cover", contain: "object-contain", fill: "object-fill" }[v] || arb(prop, v)];
    case "cursor": return [v === "pointer" ? "cursor-pointer" : arb(prop, v)];
    case "border": return [v === "none" ? "border-0" : arb(prop, v)];
    default: return [arb(prop, v)];
  }
}

/** css: {prop: value}; prefix: optional variant, e.g. "max-md:". Returns array of class tokens (stable order). */
export function cssToTailwind(css, prefix = "") {
  const out = [];
  for (const [p, v] of Object.entries(css || {})) {
    if (v === undefined || v === null || v === "") continue;
    for (const c of declarationToClasses(p, v)) out.push(prefix + c);
  }
  return out;
}
