/**
 * Adapter: Figma REST API `GET /v1/files/:key` JSON -> normalized design document.
 *
 * Normalized node (engine contract):
 *  { id, name, type, visible, opacity, blendMode, x, y, width, height, rotation(deg, CCW),
 *    constraints:{horizontal:MIN|MAX|CENTER|STRETCH|SCALE, vertical}, layout:{mode,gap,counterGap,wrap,padding,primaryAlign,counterAlign,primarySizing,counterSizing},
 *    childLayout:{grow,align,positioning}, fills, strokes, strokeWeight, strokeAlign, strokeDashes, individualStrokeWeights,
 *    cornerRadius, cornerRadii, clipsContent, effects, text:{characters,style,runs}, componentId, componentName, children }
 *  x/y are relative to the parent; for rotated nodes they locate the UNROTATED box with the same centre.
 */
const H = { LEFT: "MIN", RIGHT: "MAX", CENTER: "CENTER", LEFT_RIGHT: "STRETCH", SCALE: "SCALE" };
const V = { TOP: "MIN", BOTTOM: "MAX", CENTER: "CENTER", TOP_BOTTOM: "STRETCH", SCALE: "SCALE" };

export function normalizeRestFile(file, { name } = {}) {
  const components = {};
  for (const [id, c] of Object.entries(file.components || {})) components[id] = { name: c.name, key: c.key };
  const sets = file.componentSets || {};
  const unsupported = new Set();
  const ctx = { components, sets, unsupported };
  const pages = (file.document?.children || []).map((canvas) => ({
    id: canvas.id, name: canvas.name, type: "PAGE", visible: true, x: 0, y: 0, width: 0, height: 0,
    background: canvas.backgroundColor || null,
    children: (canvas.children || []).map((c) => norm(c, null, ctx)).filter(Boolean),
  }));
  return {
    source: "figma-rest", name: name || file.name || "Figma design", version: file.version, lastModified: file.lastModified,
    pages, components,
    unsupportedFeatures: [...unsupported].sort(),
  };
}

const paint = (p) => ({
  type: p.type, visible: p.visible !== false, opacity: p.opacity ?? 1, color: p.color, blendMode: p.blendMode,
  handles: p.gradientHandlePositions, stops: p.gradientStops?.map((s) => ({ position: s.position, color: s.color })),
  imageRef: p.imageRef, scaleMode: p.scaleMode,
});

function norm(n, parent, ctx) {
  if (!n) return null;
  const bb = n.absoluteBoundingBox;
  const w = n.size?.x ?? bb?.width ?? 0, h = n.size?.y ?? bb?.height ?? 0;
  let x = 0, y = 0, rotation = 0;
  const t = n.relativeTransform;
  if (t) {
    const [[a, b, tx], , ] = t; const ty = t[1][2];
    rotation = Math.abs(b) > 1e-4 ? (Math.atan2(b, a) * 180) / Math.PI : 0;
    if (rotation) { // locate unrotated box with the same centre
      const cx = a * (w / 2) + t[0][1] * (h / 2) + tx, cy = t[1][0] * (w / 2) + t[1][1] * (h / 2) + ty;
      x = cx - w / 2; y = cy - h / 2;
    } else { x = tx; y = ty; }
  } else if (bb) {
    const pb = parent?.absoluteBoundingBox; x = bb.x - (pb?.x || 0); y = bb.y - (pb?.y || 0);
  }
  const out = {
    id: n.id, name: n.name ?? n.type, type: n.type, visible: n.visible !== false, opacity: n.opacity ?? 1, blendMode: n.blendMode,
    x, y, width: w, height: h, rotation,
    constraints: n.constraints ? { horizontal: H[n.constraints.horizontal] || "MIN", vertical: V[n.constraints.vertical] || "MIN" } : undefined,
    fills: (n.fills || []).map(paint), strokes: (n.strokes || []).map(paint),
    strokeWeight: n.strokeWeight, strokeAlign: n.strokeAlign, strokeDashes: n.strokeDashes,
    individualStrokeWeights: n.individualStrokeWeights,
    cornerRadius: n.cornerRadius, cornerRadii: n.rectangleCornerRadii,
    clipsContent: n.clipsContent, effects: (n.effects || []).map((e) => ({ type: e.type, visible: e.visible !== false, radius: e.radius, spread: e.spread, color: e.color, offset: e.offset })),
    isMask: n.isMask,
  };
  if (n.type === "INSTANCE") {
    out.componentId = n.componentId;
    const c = ctx.components[n.componentId];
    if (c) out.componentName = c.name;
  }
  if (n.layoutMode === "HORIZONTAL" || n.layoutMode === "VERTICAL") {
    const fix = (axis, legacy) => (n[`layoutSizing${axis}`] ? (n[`layoutSizing${axis}`] === "HUG" ? "AUTO" : "FIXED") : legacy === "AUTO" ? "AUTO" : "FIXED");
    const horiz = n.layoutMode === "HORIZONTAL";
    out.layout = {
      mode: n.layoutMode, gap: n.itemSpacing || 0, counterGap: n.counterAxisSpacing || 0, wrap: n.layoutWrap === "WRAP",
      padding: { top: n.paddingTop || 0, right: n.paddingRight || 0, bottom: n.paddingBottom || 0, left: n.paddingLeft || 0 },
      primaryAlign: n.primaryAxisAlignItems || "MIN", counterAlign: n.counterAxisAlignItems || "MIN",
      primarySizing: fix(horiz ? "Horizontal" : "Vertical", n.primaryAxisSizingMode),
      counterSizing: fix(horiz ? "Vertical" : "Horizontal", n.counterAxisSizingMode),
    };
  }
  if (parent?.layoutMode === "HORIZONTAL" || parent?.layoutMode === "VERTICAL") {
    const horiz = parent.layoutMode === "HORIZONTAL";
    const primary = n[`layoutSizing${horiz ? "Horizontal" : "Vertical"}`], counter = n[`layoutSizing${horiz ? "Vertical" : "Horizontal"}`];
    out.childLayout = {
      grow: primary ? (primary === "FILL" ? 1 : 0) : n.layoutGrow || 0,
      align: counter ? (counter === "FILL" ? "STRETCH" : "INHERIT") : n.layoutAlign === "STRETCH" ? "STRETCH" : "INHERIT",
      positioning: n.layoutPositioning === "ABSOLUTE" ? "ABSOLUTE" : "AUTO",
    };
  }
  if (n.type === "TEXT") {
    const base = n.style || {};
    const style = {
      fontFamily: base.fontFamily, fontWeight: base.fontWeight, fontSize: base.fontSize, italic: base.italic, fontStyle: undefined,
      textAlignHorizontal: base.textAlignHorizontal, textAlignVertical: base.textAlignVertical, letterSpacing: base.letterSpacing,
      lineHeightPx: base.lineHeightPx, lineHeightUnit: base.lineHeightUnit, lineHeightPercentFontSize: base.lineHeightPercentFontSize,
      textCase: base.textCase, textDecoration: base.textDecoration, textAutoResize: base.textAutoResize, textTruncation: base.textTruncation,
    };
    out.text = { characters: n.characters || "", style, runs: buildRuns(n, style) };
    if (n.style?.hyperlink?.url) out.text.hyperlink = n.style.hyperlink.url;
  }
  if (n.exportSettings?.length) ctx.unsupported.add("Export settings are ignored");
  if (n.layoutGrids?.length) ctx.unsupported.add("Layout grids are ignored");
  if (n.interactions?.length || n.transitionNodeID) ctx.unsupported.add("Prototype interactions are ignored");
  if (n.type === "BOOLEAN_OPERATION") out.booleanOperation = n.booleanOperation;
  out.children = (n.children || []).map((c) => norm(c, n, ctx)).filter(Boolean);
  return out;
}

function buildRuns(n, baseStyle) {
  const chars = n.characters || "";
  const ov = n.characterStyleOverrides || [];
  if (!ov.length || !n.styleOverrideTable) return [{ text: chars }];
  const runs = [];
  let start = 0;
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || (ov[i] || 0) !== (ov[start] || 0)) {
      const id = ov[start] || 0;
      const o = id ? n.styleOverrideTable[id] : null;
      runs.push(o ? { text: chars.slice(start, i), style: { ...baseStyle, ...pickStyle(o) }, fills: o.fills?.map(paint) } : { text: chars.slice(start, i) });
      start = i;
    }
  }
  return runs;
}
const pickStyle = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !["fills"].includes(k)));
