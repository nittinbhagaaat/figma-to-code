import { px, round, near } from "../utils/number.js";
import { paintsToBackground, firstColor, hasGradientText } from "../styles/paint.js";
import { effectsToCss } from "../styles/effects.js";
import { textStyleToCss } from "../styles/typography.js";
import { inferFlow } from "../layout/infer.js";
import { containerTag, textTag } from "./semantics.js";

const CONTAINERS = new Set(["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"]);
const VECTORS = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "REGULAR_POLYGON"]);
const MIX = { MULTIPLY: "multiply", SCREEN: "screen", OVERLAY: "overlay", DARKEN: "darken", LIGHTEN: "lighten", COLOR_DODGE: "color-dodge", COLOR_BURN: "color-burn", HARD_LIGHT: "hard-light", SOFT_LIGHT: "soft-light", DIFFERENCE: "difference", EXCLUSION: "exclusion", HUE: "hue", SATURATION: "saturation", COLOR: "color", LUMINOSITY: "luminosity" };
const JUSTIFY = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between" };
const ALIGN = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", BASELINE: "baseline" };

/**
 * Builds the framework-independent IR for one root node.
 * IR node: { id, name, tag, kind:'box'|'text'|'image', css, place, media, placeMedia, attrs, children, text?, image?, component? }
 *  - css:   intrinsic styling (appearance + how it lays out its own children)
 *  - place: placement styling inside its parent (position offsets, flex growth, margins)
 */
export function buildIR(root, ctx) {
  const state = { h1: false };
  const rootInfo = { kind: "root", width: root.width, height: root.height };
  const ir = build(root, rootInfo, 0, true, ctx, state);
  if (ir) {
    ir.place = { ...ir.place };
    ir.css = { ...ir.css };
    ir.css["width"] = "100%";
    ir.css["max-width"] = px(root.width);
    ir.css["margin"] = "0 auto";
    if (!ir.css.display && ir.css.position !== "relative") ir.css.position = "relative";
    delete ir.css["flex-shrink"];
  }
  return ir;
}

function build(n, parent, depth, isRoot, ctx, state) {
  const { report } = ctx;
  if (n.visible === false) { report.skip(n, "Hidden layer"); return null; }
  if ((n.opacity ?? 1) === 0) { report.skip(n, "Fully transparent layer"); return null; }
  let ir;
  if (n.type === "TEXT") ir = buildText(n, parent, ctx, state);
  else if (VECTORS.has(n.type) || (n.type === "LINE" && n.svg)) ir = buildVector(n, parent, ctx);
  else if (n.type === "LINE") ir = buildLine(n, parent, ctx);
  else if (n.type === "RECTANGLE" || n.type === "ELLIPSE") ir = buildShape(n, parent, ctx);
  else if (CONTAINERS.has(n.type)) ir = buildContainer(n, parent, depth, isRoot, ctx, state);
  else { report.unsupported(n, `Node type ${n.type}`); return null; }
  if (ir) {
    ir.component = n.type === "INSTANCE" ? n.componentName || n.componentId || null : null;
    ir.figmaType = n.type;
    ir.originId = n.id;
    report.ok();
  }
  return ir;
}

/* ---------- sizing & placement ---------- */

function axisSizing(n, axis) {
  // returns "hug" | "fixed"
  if (n.type === "TEXT") {
    const r = n.text?.style?.textAutoResize;
    if (r === "WIDTH_AND_HEIGHT") return "hug";
    if (r === "HEIGHT") return axis === "x" ? "fixed" : "hug";
    return "fixed";
  }
  const l = n.layout;
  if (l && l.mode && l.mode !== "NONE") {
    const primaryIsX = l.mode === "HORIZONTAL";
    const sz = (axis === "x") === primaryIsX ? l.primarySizing : l.counterSizing;
    return sz === "AUTO" ? "hug" : "fixed";
  }
  return "fixed";
}

function placement(n, parent, ctx) {
  const css = {}; const place = {}; const media = {};
  const w = n.width, h = n.height;
  const rotated = n.rotation && Math.abs(n.rotation) > 0.01;
  const abs = parent.kind === "abs" || n.childLayout?.positioning === "ABSOLUTE";

  if (parent.kind === "root") {
    // root width/margins are finalised by buildIR; height by buildContainer
  } else if (abs) {
    place.position = "absolute";
    const c = n.constraints || { horizontal: "MIN", vertical: "MIN" };
    const pw = parent.width, ph = parent.height;
    const hz = c.horizontal, vt = c.vertical;
    const fixedW = (px_) => { css.width = px(px_); };
    if (hz === "MAX") { place.right = px(pw - n.x - w); fixedW(w); }
    else if (hz === "CENTER") { place.left = "50%"; place["margin-left"] = px(n.x - pw / 2); fixedW(w); }
    else if (hz === "STRETCH") { place.left = px(n.x); place.right = px(pw - n.x - w); }
    else if (hz === "SCALE") { place.left = `${round((n.x / pw) * 100, 3)}%`; place.width = `${round((w / pw) * 100, 3)}%`; }
    else { place.left = px(n.x); if (axisSizing(n, "x") === "fixed") fixedW(w); }
    const fixedH = (px_) => { css.height = px(px_); };
    if (vt === "MAX") { place.bottom = px(ph - n.y - h); fixedH(h); }
    else if (vt === "CENTER") { place.top = "50%"; place["margin-top"] = px(n.y - ph / 2); fixedH(h); }
    else if (vt === "STRETCH") { place.top = px(n.y); place.bottom = px(ph - n.y - h); }
    else if (vt === "SCALE") { place.top = `${round((n.y / ph) * 100, 3)}%`; place.height = `${round((h / ph) * 100, 3)}%`; }
    else { place.top = px(n.y); if (axisSizing(n, "y") === "fixed") fixedH(h); }
    if (n.type === "TEXT" && axisSizing(n, "x") === "hug") css["white-space"] = /\n/.test(n.text?.characters || "") ? "pre" : "nowrap";
  } else {
    // inside a flex container (auto layout or inferred flow)
    const horiz = parent.mode === "HORIZONTAL";
    const primary = horiz ? "x" : "y", counter = horiz ? "y" : "x";
    const sizeOf = (a) => (a === "x" ? w : h);
    const prop = (a) => (a === "x" ? "width" : "height");
    if (n.childLayout?.grow) {
      place.flex = "1 1 0"; place[horiz ? "min-width" : "min-height"] = "0";
      if (parent.kind === "auto") ctx.mobileGrow = true;
    } else if (axisSizing(n, primary) === "fixed") { css[prop(primary)] = px(sizeOf(primary)); if (horiz) place["flex-shrink"] = "0"; }
    if (n.childLayout?.align === "STRETCH" && parent.kind === "auto") place["align-self"] = "stretch";
    else if (axisSizing(n, counter) === "fixed") css[prop(counter)] = px(sizeOf(counter));
    if (n.type === "TEXT" && axisSizing(n, "x") === "hug") css["white-space"] = /\n/.test(n.text?.characters || "") ? "pre" : "nowrap";
    if (parent.margins && parent.margins[parent.index - 1] != null && parent.index > 0) place[horiz ? "margin-left" : "margin-top"] = px(parent.margins[parent.index - 1]);
  }
  if (rotated) {
    css.transform = `rotate(${round(-n.rotation, 2)}deg)`;
    ctx.report.approx(n, "Rotation applied via CSS transform about the centre");
  }
  if (css.width && css.width !== "100%" && !css["max-width"] && parent.kind !== "root") css["max-width"] = "100%";
  return { css, place, media };
}

/* ---------- common visual styling ---------- */

function visualStyle(n, ctx, { text = false } = {}) {
  const css = {};
  const { report } = ctx;
  if (!text) {
    const bg = paintsToBackground(n.fills, ctx);
    bg.approximations.forEach((a) => report.approx(n, a));
    if (bg.color) css["background-color"] = bg.color;
    else if (bg.layers.length) {
      const imgs = (n.fills || []).filter((f) => f.visible !== false && f.type === "IMAGE");
      css.background = bg.layers.join(", ");
      if (imgs.length) {
        const mode = imgs[imgs.length - 1].scaleMode;
        css["background-size"] = mode === "FIT" ? "contain" : mode === "TILE" ? "auto" : mode === "STRETCH" ? "100% 100%" : "cover";
        css["background-repeat"] = mode === "TILE" ? "repeat" : "no-repeat";
        css["background-position"] = "center";
      }
    }
  }
  strokeStyle(n, css, report, text);
  const radius = radiusCss(n);
  if (radius && !text) css["border-radius"] = radius;
  const fx = effectsToCss(n.effects, { isText: text });
  Object.assign(css, fx.css);
  fx.notes.forEach((m) => report.approx(n, m));
  if (n.clipsContent && !text) css.overflow = "hidden";
  if (n.opacity !== undefined && n.opacity < 1) css.opacity = String(round(n.opacity, 3));
  if (n.blendMode && MIX[n.blendMode]) css["mix-blend-mode"] = MIX[n.blendMode];
  else if (n.blendMode && !["NORMAL", "PASS_THROUGH"].includes(n.blendMode)) report.unsupported(n, `Blend mode ${n.blendMode}`);
  if (n.mask || n.isMask) report.unsupported(n, "Masks are not supported");
  return css;
}

function radiusCss(n) {
  if (n.type === "ELLIPSE") return "50%";
  const r = n.cornerRadii;
  if (r && r.length === 4 && !r.every((x) => x === r[0])) return r.map(px).join(" ");
  const v = r?.[0] ?? n.cornerRadius;
  return v ? px(v) : null;
}

function strokeStyle(n, css, report, isText) {
  const strokes = (n.strokes || []).filter((s) => s.visible !== false);
  if (!strokes.length) return;
  if (isText) { report.approx(n, "Text strokes are not supported; ignored"); return; }
  const s = strokes[strokes.length - 1];
  if (strokes.length > 1) report.approx(n, "Multiple strokes: only the top stroke is rendered");
  if (s.type !== "SOLID") report.approx(n, `${s.type} stroke approximated with a solid colour`);
  const color = firstColor([s]);
  if (!color) return;
  const style = n.strokeDashes?.length ? "dashed" : "solid";
  const align = n.strokeAlign || "INSIDE";
  const iw = n.individualStrokeWeights;
  if (align === "INSIDE") {
    if (iw && !(iw.top === iw.right && iw.right === iw.bottom && iw.bottom === iw.left)) {
      for (const side of ["top", "right", "bottom", "left"]) if (iw[side]) css[`border-${side}`] = `${px(iw[side])} ${style} ${color}`;
    } else css.border = `${px(n.strokeWeight || 1)} ${style} ${color}`;
  } else {
    const wgt = n.strokeWeight || 1;
    css.outline = `${px(wgt)} ${style} ${color}`;
    css["outline-offset"] = align === "CENTER" ? px(-wgt / 2) : "0";
    if (align === "CENTER") report.approx(n, "Centered stroke approximated with outline");
  }
}

/* ---------- node builders ---------- */

function newIR(n, tag, kind) {
  return { id: n.id, name: n.name, tag, kind, css: {}, place: {}, media: {}, placeMedia: {}, attrs: {}, children: [] };
}

function buildShape(n, parent, ctx) {
  const pl = placement(n, parent, ctx);
  const css = { ...visualStyle(n, ctx) };
  // a rectangle with one image fill and nothing else becomes a real <img>
  const fills = (n.fills || []).filter((f) => f.visible !== false);
  if (n.type === "RECTANGLE" && fills.length === 1 && fills[0].type === "IMAGE") {
    const url = ctx.imageUrl?.(fills[0].imageRef);
    if (url) {
      const ir = newIR(n, "img", "image");
      delete css.background; delete css["background-size"]; delete css["background-repeat"]; delete css["background-position"];
      ir.css = { ...pl.css, ...css, "object-fit": fills[0].scaleMode === "FIT" ? "contain" : "cover", display: "block" };
      const st = pl.place["align-self"] === "stretch";
      if (!ir.css.width && !pl.place.flex && !(st && parent.mode === "VERTICAL")) ir.css.width = px(n.width);
      if (!ir.css.height && !pl.place.flex && !(st && parent.mode === "HORIZONTAL")) ir.css.height = px(n.height);
      ir.place = pl.place;
      ir.image = { src: url, alt: n.name };
      return ir;
    }
    ctx.report.assetFailure(n, `Image ${fills[0].imageRef} could not be extracted`);
  }
  const ir = newIR(n, "div", "box");
  ir.css = { ...pl.css, ...css };
  const stretched = pl.place["align-self"] === "stretch";
  if (!ir.css.width && !pl.place.width && !pl.place.right && !pl.place.flex && !(stretched && parent.mode === "VERTICAL")) ir.css.width = px(n.width);
  if (!ir.css.height && !pl.place.height && !pl.place.bottom && !pl.place.flex && !(stretched && parent.mode === "HORIZONTAL")) ir.css.height = px(n.height);
  ir.place = pl.place;
  return ir;
}

function buildLine(n, parent, ctx) {
  const ir = newIR(n, "div", "box");
  const pl = placement(n, parent, ctx);
  const stroke = firstColor((n.strokes || []).filter((s) => s.visible !== false));
  ir.css = { ...pl.css, width: pl.css.width || px(n.width || 0), height: "0" };
  if (stroke) ir.css["border-top"] = `${px(n.strokeWeight || 1)} ${n.strokeDashes?.length ? "dashed" : "solid"} ${stroke}`;
  if (n.opacity < 1) ir.css.opacity = String(round(n.opacity, 3));
  ir.place = pl.place;
  return ir;
}

function buildVector(n, parent, ctx) {
  const src = ctx.svgUrl?.(n.id);
  const pl = placement(n, parent, ctx);
  if (!src) {
    ctx.report.assetFailure(n, `No SVG available for ${n.type} "${n.name}" — an empty sized box was emitted`);
    const ir = newIR(n, "div", "box");
    ir.css = { ...pl.css, width: pl.css.width || px(n.width), height: pl.css.height || px(n.height) };
    ir.place = pl.place;
    return ir;
  }
  const ir = newIR(n, "img", "image");
  ir.css = { ...pl.css, display: "block", width: pl.css.width || px(n.width), height: pl.css.height || px(n.height) };
  if (n.opacity < 1) ir.css.opacity = String(round(n.opacity, 3));
  ir.place = pl.place;
  ir.image = { src, alt: n.name };
  return ir;
}

function buildText(n, parent, ctx, state) {
  const pl = placement(n, parent, ctx);
  const tag = textTag(n, state, parent.tag);
  const ir = newIR(n, tag, "text");
  const style = n.text?.style || {};
  const baseCss = textStyleToCss(style, n.fills);
  if (hasGradientText(n.fills)) ctx.report.approx(n, "Gradient text fill approximated with its first colour");
  const vis = visualStyle(n, ctx, { text: true });
  ir.css = { margin: "0", ...pl.css, ...baseCss, ...vis };
  ir.place = pl.place;
  const runs = n.text?.runs?.length ? n.text.runs : [{ text: n.text?.characters || "" }];
  ir.text = {
    runs: runs.map((r) => {
      const rcss = r.style ? textStyleToCss({ ...style, ...r.style }, r.fills || n.fills) : baseCss;
      const diff = {};
      for (const [k, v] of Object.entries(rcss)) if (baseCss[k] !== v) diff[k] = v;
      return { text: r.text ?? (n.text.characters || "").slice(r.start, r.end), css: diff };
    }),
  };
  if (ctx.options.responsive !== false && (style.fontSize || 0) >= 40) {
    const k = 0.6;
    const m = { "font-size": px(Math.round(style.fontSize * k)) };
    if (baseCss["line-height"]?.endsWith("px")) m["line-height"] = px(Math.round(parseFloat(baseCss["line-height"]) * k));
    ir.media.md = m;
    ctx.report.approx(n, "Responsive: large text scaled to 60% below 768px (heuristic)");
  }
  const v = style.textAlignVertical;
  if (v && v !== "TOP" && axisSizing(n, "y") === "fixed" && ir.text.runs.length === 1) {
    ir.css.display = "flex"; ir.css["flex-direction"] = "column";
    ir.css["justify-content"] = v === "CENTER" ? "center" : "flex-end";
  }
  if (style.truncation === "ENDING" || style.textTruncation === "ENDING") {
    ir.css.overflow = "hidden"; ir.css["text-overflow"] = "ellipsis";
    ctx.report.approx(n, "Text truncation approximated with text-overflow: ellipsis");
  }
  if (n.text?.hyperlink) ir.attrs.href = n.text.hyperlink;
  return ir;
}

function buildContainer(n, parent, depth, isRoot, ctx, state) {
  const tag = containerTag(n, { isRoot, depth });
  const ir = newIR(n, tag, "box");
  const pl = placement(n, parent, ctx);
  const css = { ...pl.css, ...visualStyle(n, ctx) };
  ir.place = pl.place;
  const kids = (n.children || []);
  const visibleKids = kids.filter((k) => k.visible !== false);
  for (const k of kids) if (k.visible === false) report_(ctx, k);
  const L = n.layout;
  let info; // child placement context
  let ordered = visibleKids;
  let flowPadding = null;

  if (L && (L.mode === "HORIZONTAL" || L.mode === "VERTICAL")) {
    const horiz = L.mode === "HORIZONTAL";
    css.display = "flex";
    css["flex-direction"] = horiz ? "row" : "column";
    if (L.wrap) css["flex-wrap"] = "wrap";
    if (L.gap) css.gap = px(L.gap);
    if (L.wrap && L.counterGap) css["row-gap"] = px(L.counterGap);
    const pj = L.primaryAlign === "SPACE_BETWEEN" && visibleKids.length < 2 ? "MIN" : L.primaryAlign;
    if (JUSTIFY[pj] && pj !== "MIN") css["justify-content"] = JUSTIFY[pj];
    if (ALIGN[L.counterAlign] && L.counterAlign !== "MIN") css["align-items"] = ALIGN[L.counterAlign];
    setPadding(css, L.padding);
    info = { kind: "auto", mode: L.mode, width: n.width, height: n.height, tag };
    if (visibleKids.some((k) => k.childLayout?.positioning === "ABSOLUTE")) css.position = "relative";
  } else {
    const flow = ctx.options.inferLayout !== false && visibleKids.length >= 2 && !visibleKids.some((k) => k.rotation && Math.abs(k.rotation) > 0.01) && !visibleKids.some((k) => k.isMask)
      ? inferFlow({ width: n.width, height: n.height }, visibleKids) : null;
    if (flow) {
      css.display = "flex"; css["flex-direction"] = flow.mode === "VERTICAL" ? "column" : "row";
      if (flow.gap) css.gap = px(flow.gap);
      if (flow.align !== "MIN") css["align-items"] = ALIGN[flow.align];
      setPadding(css, flow.padding);
      flowPadding = flow.padding;
      ordered = flow.order.map((i) => visibleKids[i]);
      info = { kind: "flow", mode: flow.mode, margins: flow.margins, width: n.width, height: n.height, tag };
      ctx.report.approx(n, `Auto Layout inferred from child geometry (${flow.mode.toLowerCase()} flow)`);
      // fixed container height would fight inferred padding; let content define it, keep a floor
      if (css.height) { css["min-height"] = css.height; delete css.height; }
    } else if (visibleKids.length) {
      css.position = css.position || "relative";
      if (!css.height && !isRoot && axisSizing(n, "y") === "fixed") css.height = px(n.height);
      if (isRoot && !css.height) css.height = px(n.height);
      info = { kind: "abs", width: n.width, height: n.height, tag };
      if (visibleKids.length > 1) ctx.report.approx(n, "Children positioned absolutely using Figma constraints (no regular flow detected)");
    }
  }
  if (css.display === "flex" && css.height) { css["min-height"] = css.height; delete css.height; } // let content grow when it reflows
  ir.css = css;

  const out = [];
  ordered.forEach((k, idx) => {
    const childInfo = { ...info, index: idx };
    const c = build(k, childInfo, depth + 1, false, ctx, state);
    if (c) out.push(c);
  });
  // children that were skipped shift margin indexes: recompute not needed because margins only exist for inferred flows (all visible)
  ir.children = out;

  // button with only a text child: keep semantic tag and reset browser defaults
  if (tag === "button") {
    ir.css.cursor = "pointer";
    if (!ir.css.border && !ir.css.outline) ir.css.border = "none";
    if (!ir.css["background-color"] && !ir.css.background) ir.css["background-color"] = "transparent";
  }
  if (tag === "ul") { ir.css["list-style"] = "none"; ir.css.margin = ir.css.margin || "0"; ir.css["padding"] = ir.css.padding || "0"; }

  // responsive: large side padding shrinks on small screens
  const pad = L?.padding && L.mode !== "NONE" ? L.padding : flowPadding;
  if (ctx.options.responsive !== false && pad && (pad.left > 32 || pad.right > 32)) {
    const { top, bottom, left, right } = pad;
    ir.media.md = { ...(ir.media.md || {}), padding: `${px(top)} ${px(Math.min(right, 24))} ${px(bottom)} ${px(Math.min(left, 24))}` };
    ctx.report.approx(n, "Responsive: side padding capped at 24px below 768px (heuristic)");
  }
  // responsive: wide horizontal rows stack on small screens
  if (ctx.options.responsive !== false && info && (info.kind === "auto" || info.kind === "flow") && info.mode === "HORIZONTAL" && !css["flex-wrap"]) {
    const boxKids = out.filter((c) => c.kind !== "text").length;
    if (n.width > 640 && out.length >= 2 && boxKids >= 2) {
      ir.media.md = { ...(ir.media.md || {}), "flex-direction": "column", "align-items": "stretch" };
      for (const c of out) {
        if (c.place.flex) c.placeMedia.md = { ...(c.placeMedia.md || {}), flex: "none", width: "100%" };
        else if (c.css.width && c.css.width !== "100%") c.media.md = { ...(c.media.md || {}), width: "100%" };
      }
      ctx.report.approx(n, "Responsive: row stacks vertically below 768px (heuristic)");
    }
  }
  return ir;
}

function report_(ctx, k) { ctx.report.skip(k, "Hidden layer"); }

function setPadding(css, p) {
  if (!p) return;
  const { top = 0, right = 0, bottom = 0, left = 0 } = p;
  if (top || right || bottom || left) css.padding = top === bottom && left === right ? (top === left ? px(top) : `${px(top)} ${px(left)}`) : `${px(top)} ${px(right)} ${px(bottom)} ${px(left)}`;
}

export { near };
