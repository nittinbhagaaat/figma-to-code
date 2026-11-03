import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { normalizeRestFile } from "@/engine/parsers/figma-rest.js";
import { convertDocument, collectAssetNeeds } from "@/engine/generators/convert.js";

const fixture = JSON.parse(fs.readFileSync("tests/fixtures/landing.rest.json", "utf8"));
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const assets = () => ({ images: new Map(["imgref-aaaa", "imgref-bbbb", "imgref-cccc"].map((r) => [r, { ext: "png", bytes: png }])), svgs: new Map() });

describe("engine", () => {
  const doc = normalizeRestFile(fixture);
  it("normalizes pages and nodes", () => {
    expect(doc.pages).toHaveLength(1);
    const root = doc.pages[0].children[0];
    expect(root.name).toBe("Landing Page");
    expect(root.children.map((c) => c.name)).toEqual(["Header", "Hero", "Features", "Footer"]);
    const header = root.children[0];
    expect(header.layout.mode).toBe("HORIZONTAL");
    expect(header.layout.padding.left).toBe(80);
  });
  it("collects asset needs", () => {
    const n = collectAssetNeeds(doc, []);
    expect(n.images.sort()).toEqual(["imgref-aaaa", "imgref-bbbb", "imgref-cccc"]);
  });
  for (const framework of ["html", "react", "nextjs"]) for (const styling of ["css", "tailwind"]) {
    it(`generates ${framework}/${styling} deterministically`, () => {
      const a = convertDocument(doc, { framework, styling }, assets());
      const b = convertDocument(doc, { framework, styling }, assets());
      expect(a.files.map((f) => f.path)).toEqual(b.files.map((f) => f.path));
      expect(a.files.every((f, i) => f.content === b.files[i].content || Buffer.compare(Buffer.from(f.content), Buffer.from(b.files[i].content)) === 0)).toBe(true);
      expect(a.report.summary.converted).toBeGreaterThan(10);
    });
  }
});
