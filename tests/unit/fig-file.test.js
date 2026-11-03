import { describe, it, expect } from "vitest";
import pako from "pako";
import JSZip from "jszip";
import { parseSchema, compileSchema, encodeBinarySchema } from "kiwi-schema";
import { parseFigFile, validateFigSignature, FigParseError, blobToPath } from "@/engine/parsers/fig-file.js";
import { convertDocument } from "@/engine/generators/convert.js";

// A minimal schema using the same field names the adapter reads. NOT Figma's real schema.
const SCHEMA = `
message Guid { uint sessionID = 1; uint localID = 2; }
message ParentIndex { Guid guid = 1; string position = 2; }
message Color { float r = 1; float g = 2; float b = 3; float a = 4; }
message Vec { float x = 1; float y = 2; }
message Matrix { float m00 = 1; float m01 = 2; float m02 = 3; float m10 = 4; float m11 = 5; float m12 = 6; }
message Paint { string type = 1; Color color = 2; float opacity = 3; bool visible = 4; }
message FontName { string family = 1; string style = 2; }
message TextData { string characters = 1; }
message NodeChange {
  Guid guid = 1; ParentIndex parentIndex = 2; string type = 3; string name = 4; Vec size = 5; Matrix transform = 6;
  Paint[] fillPaints = 7; string stackMode = 8; float stackSpacing = 9; float stackPaddingLeft = 10; float stackPaddingTop = 11;
  float cornerRadius = 12; TextData textData = 13; float fontSize = 14; FontName fontName = 15; string textAutoResize = 16; bool visible = 17;
}
message Message { NodeChange[] nodeChanges = 1; }
`;
const schemaObj = parseSchema(SCHEMA);
const compiled = compileSchema(schemaObj);
const id = (n) => ({ sessionID: 0, localID: n });
const node = (n, parent, pos, type, name, extra = {}) => ({ guid: id(n), parentIndex: parent == null ? undefined : { guid: id(parent), position: pos }, type, name, ...extra });
const I = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

function buildCanvas(message) {
  const chunk = (u8) => { const d = pako.deflateRaw(u8); const b = Buffer.alloc(4 + d.length); b.writeUInt32LE(d.length, 0); Buffer.from(d).copy(b, 4); return b; };
  const head = Buffer.alloc(12); head.write("fig-kiwi", 0, "latin1"); head.writeUInt32LE(70, 8);
  return Buffer.concat([head, chunk(encodeBinarySchema(schemaObj)), chunk(compiled.encodeMessage(message))]);
}
const message = {
  nodeChanges: [
    node(0, undefined, "", "DOCUMENT", "Document"),
    node(1, 0, "a", "CANVAS", "Page 1"),
    node(2, 1, "a", "FRAME", "Card", { size: { x: 400, y: 200 }, transform: { ...I, m02: 100, m12: 50 }, stackMode: "VERTICAL", stackSpacing: 12, stackPaddingLeft: 20, stackPaddingTop: 20, cornerRadius: 12, fillPaints: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }] }),
    node(4, 2, "b", "TEXT", "Second", { size: { x: 100, y: 20 }, transform: I, textData: { characters: "World" }, fontSize: 16, fontName: { family: "Inter", style: "Regular" }, textAutoResize: "WIDTH_AND_HEIGHT" }),
    node(3, 2, "a", "TEXT", "First", { size: { x: 100, y: 20 }, transform: I, textData: { characters: "Hello" }, fontSize: 16, fontName: { family: "Inter", style: "Bold" }, textAutoResize: "WIDTH_AND_HEIGHT" }),
  ],
};

describe(".fig parser", () => {
  it("rejects non-fig input by signature, not extension", () => {
    expect(() => validateFigSignature(Buffer.from("not a figma file at all"))).toThrow(FigParseError);
    expect(() => validateFigSignature(Buffer.from("fig-jam.xxxx"))).toThrow(/FigJam/);
  });
  it("parses a bare canvas.fig container and orders children by position", async () => {
    const doc = await parseFigFile(new Uint8Array(buildCanvas(message)));
    const card = doc.pages[0].children[0];
    expect(card.name).toBe("Card");
    expect(card.layout).toMatchObject({ mode: "VERTICAL", gap: 12 });
    expect(card.children.map((c) => c.text.characters)).toEqual(["Hello", "World"]);
    expect(card.x).toBe(100);
  });
  it("parses the zip-wrapped format and converts end-to-end", async () => {
    const zip = new JSZip();
    zip.file("canvas.fig", buildCanvas(message)); zip.file("meta.json", JSON.stringify({ file_name: "Demo" }));
    const doc = await parseFigFile(await zip.generateAsync({ type: "uint8array" }));
    expect(doc.name).toBe("Demo");
    const out = convertDocument(doc, { framework: "html", styling: "css" });
    const html = out.files.find((f) => f.path === "index.html").content;
    expect(html).toContain("Hello");
    expect(html).toContain("World");
  });
  it("ignores traversal-named archive entries (JSZip sanitises them; the reader only consumes canvas.fig, meta.json, images/*)", async () => {
    const zip = new JSZip(); zip.file("../evil.txt", "x"); zip.file("images/abc", "img"); zip.file("canvas.fig", buildCanvas(message));
    const { readContainer } = await import("@/engine/parsers/fig-file.js");
    const c = await readContainer(await zip.generateAsync({ type: "uint8array" }));
    expect([...c.images.keys()]).toEqual(["abc"]);
  });
  it("decodes vector path blobs and refuses unknown commands", () => {
    const b = Buffer.alloc(1 + 8 + 1 + 8 + 1); b[0] = 1; b.writeFloatLE(1, 1); b.writeFloatLE(2, 5); b[9] = 2; b.writeFloatLE(3, 10); b.writeFloatLE(4, 14); b[18] = 0;
    expect(blobToPath(new Uint8Array(b))).toBe("M1 2L3 4Z");
    expect(blobToPath(new Uint8Array([9]))).toBeNull();
  });
});
