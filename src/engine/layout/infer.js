import { near, round } from "../utils/number.js";

/**
 * Infers a flow (flex) layout for a container that has no Figma Auto Layout, by analysing child geometry.
 * Returns null when children overlap / are irregular, in which case the caller falls back to
 * constraint-based absolute positioning. Pure and deterministic.
 *
 * kids: [{ x, y, width, height }] (parent-relative), parent: { width, height }
 */
export function inferFlow(parent, kids, eps = 1.5) {
  if (kids.length < 2) return null;
  for (const mode of ["VERTICAL", "HORIZONTAL"]) {
    const r = tryAxis(mode, parent, kids, eps);
    if (r) return r;
  }
  return null;
}

function tryAxis(mode, parent, kids, eps) {
  const v = mode === "VERTICAL";
  const main = (k) => (v ? k.y : k.x), mainSize = (k) => (v ? k.height : k.width);
  const cross = (k) => (v ? k.x : k.y), crossSize = (k) => (v ? k.width : k.height);
  const order = kids.map((k, i) => i).sort((a, b) => main(kids[a]) - main(kids[b]) || cross(kids[a]) - cross(kids[b]));
  const sorted = order.map((i) => kids[i]);

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = main(sorted[i]) - (main(sorted[i - 1]) + mainSize(sorted[i - 1]));
    if (g < -eps) return null; // overlap along main axis
    gaps.push(Math.max(0, g));
  }
  // cross alignment
  const starts = sorted.map(cross), ends = sorted.map((k) => cross(k) + crossSize(k)), centers = sorted.map((k) => cross(k) + crossSize(k) / 2);
  const allNear = (arr) => arr.every((x) => near(x, arr[0], eps));
  let align;
  if (allNear(starts)) align = "MIN";
  else if (allNear(centers)) align = "CENTER";
  else if (allNear(ends)) align = "MAX";
  else return null;

  const parentMain = v ? parent.height : parent.width, parentCross = v ? parent.width : parent.height;
  const avg = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
  const uniform = gaps.every((g) => near(g, avg, eps));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const padMainStart = Math.max(0, main(first));
  const padMainEnd = Math.max(0, parentMain - (main(last) + mainSize(last)));
  const crossMin = Math.min(...starts), crossMax = Math.max(...ends);
  const padCrossStart = Math.max(0, crossMin), padCrossEnd = Math.max(0, parentCross - crossMax);

  const padding = v
    ? { top: padMainStart, bottom: padMainEnd, left: padCrossStart, right: padCrossEnd }
    : { left: padMainStart, right: padMainEnd, top: padCrossStart, bottom: padCrossEnd };
  // Center alignment uses symmetric padding on the cross axis so it truly centres.
  if (align === "MIN") { if (v) padding.right = 0; else padding.bottom = 0; }
  if (align === "MAX") { if (v) padding.left = 0; else padding.top = 0; }
  if (align === "CENTER") {
    const sym = Math.min(padCrossStart, padCrossEnd);
    if (v) { padding.left = sym; padding.right = sym; } else { padding.top = sym; padding.bottom = sym; }
  }
  const gap = uniform ? round(avg, 1) : 0;
  // order[] maps sorted position -> original index; margins hold non-uniform spacing before each sorted child.
  const margins = uniform ? null : gaps.map((g) => round(g, 1));
  return { mode, gap, margins, order, align, padding: { top: round(padding.top, 1), right: round(padding.right, 1), bottom: round(padding.bottom, 1), left: round(padding.left, 1) } };
}
