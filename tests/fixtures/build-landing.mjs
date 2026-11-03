// Authors a Figma REST API `GET /v1/files/:key`-shaped fixture (same schema Figma returns).
// Run: node tests/fixtures/build-landing.mjs > tests/fixtures/landing.rest.json
let nid = 0;
const id = () => `1:${++nid}`;
const solid = (r, g, b, a = 1) => ({ type: "SOLID", color: { r, g, b, a }, opacity: 1, visible: true });
const dark = solid(0.07, 0.07, 0.09), white = solid(1, 1, 1), brand = solid(0.36, 0.36, 0.84), grey = solid(0.42, 0.42, 0.46);
const bbox = (x, y, w, h) => ({ x, y, width: w, height: h });
const tf = (x, y) => [[1, 0, x], [0, 1, y]];
const base = (name, type, x, y, w, h, extra = {}) => ({ id: id(), name, type, visible: true, absoluteBoundingBox: bbox(x, y, w, h), size: { x: w, y: h }, relativeTransform: tf(x, y), ...extra });
const text = (name, chars, x, y, w, h, style, fills = [dark], extra = {}) =>
  base(name, "TEXT", x, y, w, h, { characters: chars, fills, style: { fontFamily: "Inter", fontWeight: 400, fontSize: 16, textAlignHorizontal: "LEFT", textAlignVertical: "TOP", letterSpacing: 0, lineHeightUnit: "PIXELS", lineHeightPx: 24, textAutoResize: "WIDTH_AND_HEIGHT", ...style }, characterStyleOverrides: [], styleOverrideTable: {}, ...extra });
const auto = (name, type, x, y, w, h, mode, o = {}, children = []) =>
  base(name, type, x, y, w, h, { layoutMode: mode, primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "FIXED", primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN", itemSpacing: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, fills: [], clipsContent: false, children, ...o });

const button = (label, x, y) => {
  const b = auto("Button", "INSTANCE", x, y, 140, 48, "HORIZONTAL", { componentId: "10:1", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fills: [brand], cornerRadius: 8 });
  b.children = [text("Label", label, 24, 12, 92, 24, { fontWeight: 600, textAutoResize: "WIDTH_AND_HEIGHT" }, [white])];
  return b;
};
const card = (title, desc, x, imgRef) => {
  const c = auto("Feature Card", "INSTANCE", x, 0, 360, 380, "VERTICAL", { componentId: "10:2", itemSpacing: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, fills: [white], cornerRadius: 16, clipsContent: true, strokes: [solid(0.9, 0.9, 0.92)], strokeWeight: 1, strokeAlign: "INSIDE", effects: [{ type: "DROP_SHADOW", visible: true, radius: 24, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 8 } }] });
  const img = base("Cover", "RECTANGLE", 0, 0, 360, 200, { fills: [{ type: "IMAGE", imageRef: imgRef, scaleMode: "FILL", visible: true }], layoutAlign: "STRETCH", layoutSizingHorizontal: "FILL" });
  const body = auto("Body", "FRAME", 0, 212, 360, 168, "VERTICAL", { itemSpacing: 8, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 20, layoutAlign: "STRETCH", layoutSizingHorizontal: "FILL" });
  body.children = [text("Title", title, 20, 8, 320, 28, { fontSize: 22, fontWeight: 700, lineHeightPx: 28, textAutoResize: "HEIGHT" }), text("Description", desc, 20, 44, 320, 72, { textAutoResize: "HEIGHT", lineHeightPx: 24 }, [grey])];
  c.children = [img, body];
  return c;
};

const header = auto("Header", "FRAME", 0, 0, 1440, 80, "HORIZONTAL", { primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", paddingLeft: 80, paddingRight: 80, fills: [white], strokes: [solid(0.92, 0.92, 0.94)], strokeWeight: 1 });
const nav = auto("Nav", "FRAME", 600, 28, 300, 24, "HORIZONTAL", { itemSpacing: 32, primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO" });
nav.children = ["Product", "Pricing", "Docs"].map((t, i) => text(`Link ${t}`, t, i * 80, 0, 60, 24, { fontWeight: 500 }, [grey]));
header.children = [text("Logo", "Acme", 80, 24, 70, 32, { fontSize: 24, fontWeight: 800, lineHeightPx: 32 }), nav, button("Sign up", 1220, 16)];

const hero = auto("Hero", "FRAME", 0, 80, 1440, 520, "VERTICAL", { primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", itemSpacing: 24, paddingTop: 96, paddingBottom: 96, fills: [{ type: "GRADIENT_LINEAR", visible: true, opacity: 1, gradientHandlePositions: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }], gradientStops: [{ position: 0, color: { r: 0.93, g: 0.93, b: 1, a: 1 } }, { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }] }] });
const h1 = text("Headline", "Ship designs faster", 360, 96, 720, 72, { fontSize: 64, fontWeight: 800, lineHeightPx: 72, textAlignHorizontal: "CENTER", textAutoResize: "HEIGHT" });
h1.characterStyleOverrides = [...Array(13).fill(0), ...Array(6).fill(1)];
h1.styleOverrideTable = { 1: { fills: [brand] } };
hero.children = [h1, text("Subtitle", "Turn Figma frames into production code with a deterministic compiler.", 360, 192, 720, 56, { fontSize: 20, lineHeightPx: 28, textAlignHorizontal: "CENTER", textAutoResize: "HEIGHT" }, [grey]), button("Get started", 650, 272)];

const features = auto("Features", "FRAME", 0, 600, 1440, 520, "HORIZONTAL", { itemSpacing: 40, primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "MIN", paddingTop: 70, paddingBottom: 70, fills: [solid(0.98, 0.98, 0.99)] });
features.children = [card("Auto Layout", "Maps to flexbox with gap, padding and alignment.", 90, "imgref-aaaa"), card("Components", "Repeated structures become reusable components.", 500, "imgref-bbbb"), card("Tailwind or CSS", "Pick plain CSS or Tailwind utility classes.", 910, "imgref-cccc")];
features.children.push({ ...base("Hidden Banner", "RECTANGLE", 0, 0, 100, 20, { fills: [brand] }), visible: false });

// Footer: no Auto Layout — exercises geometry-based flow inference
const footer = base("Footer", "FRAME", 0, 1120, 1440, 160, { fills: [dark], clipsContent: false, constraints: { horizontal: "LEFT_RIGHT", vertical: "TOP" } });
footer.children = [
  text("Copyright", "© 2026 Acme Inc.", 80, 40, 140, 24, { fontSize: 14, lineHeightPx: 24 }, [white], { constraints: { horizontal: "LEFT", vertical: "TOP" } }),
  text("Tagline", "Built with Figma2Code", 80, 72, 160, 24, { fontSize: 14, lineHeightPx: 24 }, [grey], { constraints: { horizontal: "LEFT", vertical: "TOP" } }),
  text("Contact", "hello@acme.dev", 80, 104, 140, 24, { fontSize: 14, lineHeightPx: 24 }, [white], { constraints: { horizontal: "LEFT", vertical: "TOP" } }),
];
// A badge overlapping others — forces absolute fallback
const overlay = base("Badge Overlay", "FRAME", 40, 1180, 200, 60, { fills: [] });
void overlay;

const root = base("Landing Page", "FRAME", 0, 0, 1440, 1280, { layoutMode: "NONE", fills: [white], clipsContent: true, children: [header, hero, features, footer] });
// root has no auto layout: header/hero/features/footer are stacked => inferred vertical flow

const file = {
  name: "Acme Landing", version: "1", lastModified: "2026-01-01T00:00:00Z",
  components: { "10:1": { key: "k1", name: "Button" }, "10:2": { key: "k2", name: "Feature Card" } },
  componentSets: {},
  document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [{ id: "0:1", name: "Page 1", type: "CANVAS", backgroundColor: { r: 0.96, g: 0.96, b: 0.96, a: 1 }, children: [root] }] },
};
console.log(JSON.stringify(file, null, 2));
