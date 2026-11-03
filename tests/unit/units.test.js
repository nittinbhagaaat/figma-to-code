import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseFigmaUrl } from "@/services/figma/url.js";
import { can, canManageRole, canRemoveMember, canInviteRole, PERMISSIONS } from "@/lib/permissions.js";
import { inferFlow } from "@/engine/layout/infer.js";
import { cssToTailwind } from "@/engine/styles/tailwind.js";
import { paintsToBackground } from "@/engine/styles/paint.js";
import { effectsToCss } from "@/engine/styles/effects.js";
import { textStyleToCss } from "@/engine/styles/typography.js";
import { componentName, createNamer, isGenericName } from "@/engine/utils/names.js";
import { buildZip } from "@/services/export/zip.js";
import { isSafePath } from "@/services/conversion/bundle.js";
import { inspectImage } from "@/services/figma/image-info.js";
import { encrypt, decrypt, signToken, verifyToken } from "@/lib/crypto.js";
import { buildPreviewDoc } from "@/lib/preview/build-doc.js";
import { normalizeRestFile } from "@/engine/parsers/figma-rest.js";
import { convertDocument } from "@/engine/generators/convert.js";

describe("Figma URL parsing", () => {
  it("extracts file key and node id", () => {
    expect(parseFigmaUrl("https://www.figma.com/design/AbC123xyz90/My-File?node-id=12-34")).toEqual({ fileKey: "AbC123xyz90", nodeId: "12:34" });
    expect(parseFigmaUrl("https://figma.com/file/AbC123xyz90/x").fileKey).toBe("AbC123xyz90");
    expect(parseFigmaUrl("https://www.figma.com/board/AbC123xyz90").fileKey).toBe("AbC123xyz90");
  });
  it("rejects look-alike hosts, http, and missing keys", () => {
    for (const u of ["http://www.figma.com/design/AbC123xyz90/x", "https://figma.com.evil.io/design/AbC123xyz90/x", "https://www.figma.com/", "not a url", "https://www.figma.com/design/short/x"]) expect(() => parseFigmaUrl(u)).toThrow();
  });
});

describe("permissions", () => {
  it("grants by role", () => {
    expect(can("viewer", "project:create")).toBe(false);
    expect(can("editor", "project:create")).toBe(true);
    expect(can("editor", "member:invite")).toBe(false);
    expect(can("admin", "project:delete")).toBe(true);
    expect(can("admin", "workspace:delete")).toBe(false);
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(can(undefined, "workspace:view")).toBe(false);
    expect(can("owner", "nonsense:perm")).toBe(false);
  });
  it("every permission is granted to owner", () => { for (const [k, roles] of Object.entries(PERMISSIONS)) expect(roles, k).toContain("owner"); });
  it("restricts role management", () => {
    expect(canManageRole("owner", "editor", "admin")).toBe(true);
    expect(canManageRole("owner", "editor", "owner")).toBe(false);
    expect(canManageRole("admin", "editor", "viewer")).toBe(true);
    expect(canManageRole("admin", "editor", "admin")).toBe(false);
    expect(canManageRole("admin", "admin", "viewer")).toBe(false);
    expect(canManageRole("editor", "viewer", "editor")).toBe(false);
    expect(canRemoveMember("admin", "owner")).toBe(false);
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("admin", "viewer")).toBe(true);
    expect(canInviteRole("admin", "admin")).toBe(false);
    expect(canInviteRole("owner", "admin")).toBe(true);
    expect(canInviteRole("owner", "owner")).toBe(false);
  });
});

describe("layout inference", () => {
  const P = { width: 400, height: 300 };
  it("detects a left-aligned vertical stack with uniform gap", () => {
    const f = inferFlow(P, [{ x: 20, y: 20, width: 100, height: 40 }, { x: 20, y: 76, width: 100, height: 40 }, { x: 20, y: 132, width: 100, height: 40 }]);
    expect(f).toMatchObject({ mode: "VERTICAL", gap: 16, align: "MIN" });
    expect(f.padding).toMatchObject({ top: 20, left: 20, right: 0 });
  });
  it("detects a centred row", () => {
    const f = inferFlow({ width: 400, height: 100 }, [{ x: 10, y: 20, width: 80, height: 60 }, { x: 110, y: 35, width: 80, height: 30 }]);
    expect(f).toMatchObject({ mode: "HORIZONTAL", align: "CENTER", gap: 20 });
  });
  it("falls back (null) on overlap or ragged alignment", () => {
    expect(inferFlow(P, [{ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 50, width: 100, height: 100 }])).toBeNull();
    expect(inferFlow(P, [{ x: 0, y: 0, width: 50, height: 20 }, { x: 70, y: 40, width: 50, height: 20 }])).toBeNull();
    expect(inferFlow(P, [{ x: 0, y: 0, width: 50, height: 20 }])).toBeNull();
  });
  it("keeps non-uniform spacing as per-child margins", () => {
    const f = inferFlow(P, [{ x: 0, y: 0, width: 50, height: 20 }, { x: 0, y: 30, width: 50, height: 20 }, { x: 0, y: 100, width: 50, height: 20 }]);
    expect(f.gap).toBe(0); expect(f.margins).toEqual([10, 50]);
  });
});

describe("style generation", () => {
  it("maps solid, gradient and image fills", () => {
    expect(paintsToBackground([{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }]).color).toBe("#ff0000");
    expect(paintsToBackground([{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.5 }]).color).toBe("rgba(0, 0, 0, 0.5)");
    const g = paintsToBackground([{ type: "GRADIENT_LINEAR", handles: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], stops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }] }]);
    expect(g.layers[0]).toBe("linear-gradient(180deg, #000000 0%, #ffffff 100%)".replace("180deg", "90deg"));
    expect(paintsToBackground([{ type: "IMAGE", imageRef: "abc" }], { imageUrl: (r) => `asset://images/${r}.png` }).layers[0]).toBe("url(asset://images/abc.png)");
    expect(paintsToBackground([{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: false }]).color).toBeNull();
  });
  it("maps effects and flags approximations", () => {
    const r = effectsToCss([{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: 2 }, { type: "LAYER_BLUR", radius: 10 }]);
    expect(r.css["box-shadow"]).toBe("0 4px 8px 2px rgba(0, 0, 0, 0.25)");
    expect(r.css.filter).toBe("blur(5px)");
    expect(r.notes.length).toBe(1);
  });
  it("maps typography", () => {
    const css = textStyleToCss({ fontFamily: "Open Sans", fontSize: 18, fontWeight: 600, lineHeightUnit: "PIXELS", lineHeightPx: 28, letterSpacing: 0.5, textAlignHorizontal: "CENTER", textDecoration: "UNDERLINE", textCase: "UPPER" }, [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }]);
    expect(css).toMatchObject({ "font-family": "'Open Sans', sans-serif", "font-size": "18px", "font-weight": "600", "line-height": "28px", "letter-spacing": "0.5px", "text-align": "center", "text-decoration": "underline", "text-transform": "uppercase", color: "#000000" });
  });
  it("converts CSS declarations to Tailwind, with a lossless fallback", () => {
    const tw = cssToTailwind({ display: "flex", "flex-direction": "column", gap: "16px", padding: "8px 24px", width: "320px", "border-radius": "12px", "font-weight": "700", "mix-blend-mode": "multiply", "background-color": "#ff0000", margin: "0 auto", height: "100%" });
    expect(tw).toEqual(["flex", "flex-col", "gap-4", "py-2", "px-6", "w-80", "rounded-[12px]", "font-bold", "[mix-blend-mode:multiply]", "bg-[#ff0000]", "mx-auto", "h-full"]);
    expect(cssToTailwind({ "padding": "10px 3px" }, "max-md:")[0]).toMatch(/^max-md:/);
    expect(cssToTailwind({ border: "1px solid rgba(0, 0, 0, 0.1)" })).toEqual(["[border:1px_solid_rgba(0,_0,_0,_0.1)]"]);
  });
});

describe("naming", () => {
  it("builds predictable, collision-free component names", () => {
    expect(componentName("hero section")).toBe("HeroSection");
    expect(componentName("3 columns")).toBe("Section3Columns");
    expect(componentName("Frame 12", "Section")).toBe("Section");
    expect(componentName("App")).toBe("AppBlock");
    expect(isGenericName("Rectangle 4")).toBe(true);
    const n = createNamer(); expect([n("Card"), n("Card"), n("Card"), n("Button")]).toEqual(["Card", "Card2", "Card3", "Button"]);
  });
});

describe("asset paths and safety", () => {
  it("validates project paths", () => {
    for (const ok of ["src/App.jsx", "public/assets/images/a-b_c.png", "README.md"]) expect(isSafePath(ok), ok).toBe(true);
    for (const bad of ["../x", "/etc/passwd", "a/../../b", "a//b", "", "a\\b", "x".repeat(300)]) expect(isSafePath(bad), bad).toBe(false);
  });
  it("detects image types by magic bytes", () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    expect(inspectImage(png)).toMatchObject({ ext: "png", width: 1, height: 1 });
    expect(inspectImage(Buffer.from("<?xml svg"))).toBeNull();
    expect(inspectImage(Buffer.from("GIF89a-not-allowed-here-.........."))).toBeNull();
  });
});

describe("ZIP export", () => {
  it("creates a complete archive with text and binary files", async () => {
    const bytes = Buffer.from([1, 2, 3, 255]);
    const buf = await buildZip([{ path: "a/b.txt", content: "hello" }, { path: "img.bin", content: bytes, binary: true }], "proj");
    const zip = await JSZip.loadAsync(buf);
    expect(await zip.file("proj/a/b.txt").async("string")).toBe("hello");
    expect([...(await zip.file("proj/img.bin").async("uint8array"))]).toEqual([1, 2, 3, 255]);
  });
  it("refuses path traversal and duplicates", async () => {
    await expect(buildZip([{ path: "../evil", content: "x" }])).rejects.toThrow(/Unsafe/);
    await expect(buildZip([{ path: "a", content: "1" }, { path: "a", content: "2" }])).rejects.toThrow(/Duplicate/);
  });
});

describe("crypto helpers", () => {
  it("round-trips encrypted secrets and detects tampering", () => {
    const c = encrypt("figd_secret_token"); expect(c).not.toContain("figd_"); expect(decrypt(c)).toBe("figd_secret_token");
    const bad = c.slice(0, -2) + (c.endsWith("AA") ? "BB" : "AA"); expect(() => decrypt(bad)).toThrow();
  });
  it("signs and expires tokens", () => {
    const t = signToken({ a: 1 }, 60); expect(verifyToken(t)).toMatchObject({ a: 1 });
    expect(verifyToken(t.slice(0, -1) + "x")).toBeNull();
    expect(verifyToken(signToken({ a: 1 }, -5))).toBeNull();
  });
});

describe("preview document", () => {
  const files = [{ path: "index.html", content: '<html><head><link rel="stylesheet" href="css/styles.css"></head><body><img src="assets/images/a.png"><script src="js/script.js"></script></body></html>' }, { path: "css/styles.css", content: "x{background:url(../assets/images/a.png)}" }, { path: "js/script.js", content: "console.log(1)" }, { path: "assets/images/a.png", binary: true, content: "QUJD" }];
  it("inlines CSS/JS/assets for HTML so the sandbox needs no network or cookies", () => {
    const d = buildPreviewDoc({ files, framework: "html", styling: "css", origin: "http://x" });
    expect(d).toContain("<style>x{background:url(data:image/png;base64,QUJD)}</style>");
    expect(d).toContain('src="data:image/png;base64,QUJD"');
    expect(d).not.toContain('href="css/styles.css"');
  });
  it("escapes </script> in embedded project data", () => {
    const d = buildPreviewDoc({ files: [{ path: "src/main.jsx", content: 'const s = "</script><script>alert(1)</script>";' }], framework: "react", styling: "css", origin: "http://x" });
    expect(d.match(/<\/script>/g).length).toBe(d.match(/<script/g).length);
  });
});

describe("generated project content", () => {
  const fixture = JSON.parse(require("node:fs").readFileSync("tests/fixtures/landing.rest.json", "utf8"));
  const doc = normalizeRestFile(fixture);
  const png = new Uint8Array([137, 80, 78, 71]);
  const gen = (framework, styling, extra = {}) => convertDocument(doc, { framework, styling, ...extra }, { images: new Map(["imgref-aaaa", "imgref-bbbb", "imgref-cccc"].map((r) => [r, { ext: "png", bytes: png }])), svgs: new Map() });
  const get = (out, p) => out.files.find((f) => f.path === p)?.content;
  it("extracts reusable components with props (React)", () => {
    const out = gen("react", "tailwind");
    expect(get(out, "src/components/Button.jsx")).toContain("label = ");
    expect(get(out, "src/components/Features.jsx").match(/<FeatureCard /g)).toHaveLength(3);
    expect(out.report.components.find((c) => c.name === "FeatureCard").instances).toBe(3);
  });
  it("uses CSS variables for repeated design tokens (plain CSS)", () => {
    const css = get(gen("html", "css"), "css/styles.css");
    expect(css).toMatch(/:root \{[^}]*--color-1/);
    expect(css).toContain("var(--color-");
    expect(css).toContain("@media (max-width: 768px)");
  });
  it("references assets from the right path per framework", () => {
    expect(get(gen("html", "css"), "css/styles.css")).not.toContain("asset://");
    expect(gen("html", "css").files.some((f) => f.path.startsWith("assets/images/"))).toBe(true);
    expect(get(gen("react", "css"), "src/components/FeatureCard.jsx")).toContain("/assets/images/");
    expect(gen("nextjs", "css").files.some((f) => f.path.startsWith("public/assets/images/"))).toBe(true);
    expect(gen("html", "tailwind").files.every((f) => !String(f.content).includes?.("asset://"))).toBe(true);
  });
  it("emits only JS (never TypeScript) and valid package scripts", () => {
    for (const fw of ["html", "react", "nextjs"]) for (const st of ["css", "tailwind"]) {
      const out = gen(fw, st);
      expect(out.files.some((f) => /\.tsx?$/.test(f.path))).toBe(false);
      const pkg = JSON.parse(get(out, "package.json"));
      if (fw === "nextjs") expect(pkg.scripts).toMatchObject({ dev: "next dev", build: "next build", start: "next start" });
      if (fw === "react") expect(pkg.scripts.build).toBe("vite build");
      expect(get(out, "README.md")).toContain("Conversion report");
    }
  });
  it("reports hidden layers and approximations instead of silently dropping them", () => {
    const r = gen("html", "css").report;
    expect(r.skipped.some((s) => s.name === "Hidden Banner")).toBe(true);
    expect(r.approximations.length).toBeGreaterThan(0);
  });
  it("reports unsupported node types and missing assets", () => {
    const d = structuredClone(doc);
    d.pages[0].children[0].children.push({ id: "9:1", name: "Sticky", type: "STICKY", visible: true, x: 0, y: 0, width: 10, height: 10, children: [] });
    const out = convertDocument(d, { framework: "html", styling: "css" }, { images: new Map(), svgs: new Map() });
    expect(out.report.unsupported.some((u) => u.feature.includes("STICKY"))).toBe(true);
    expect(out.report.assetFailures.length).toBeGreaterThan(0);
  });
  it("throws a typed error when nothing is selectable", () => {
    expect(() => convertDocument(doc, { framework: "html", styling: "css", selection: ["nope"] })).toThrow(/No convertible frames/);
  });
});
