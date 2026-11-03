import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { registerVerifyLogin, startMockFigma } from "./helpers.js";

let mock;
beforeAll(async () => { mock = await startMockFigma(); });
afterAll(async () => { await mock.close(); });

describe("figma import → generate → edit → version → export", () => {
  it("works end to end", async () => {
    const { c } = await registerVerifyLogin("Designer");
    const ws = (await c.post("/api/workspaces", { name: "Studio" })).data.id;
    const pid = (await c.post("/api/projects", { workspaceId: ws, name: "Landing" })).data.id;

    // token handling
    let r = await c.post("/api/figma/import-url", { projectId: pid, url: "https://www.figma.com/design/ABCDEF1234567/Landing" });
    expect(r.status).toBe(400); expect(r.error.details.code).toBe("NO_FIGMA_TOKEN");
    expect((await c.put("/api/figma/token", { token: "short" })).status).toBe(400);
    expect((await c.put("/api/figma/token", { token: "figd_test_token_0123456789abcdef" })).status).toBe(200);
    expect(JSON.stringify((await c.get("/api/auth/me")).data)).not.toContain("figd_");
    expect((await c.get("/api/auth/me")).data.user.hasFigmaToken).toBe(true);

    // URL validation + Figma error mapping
    expect((await c.post("/api/figma/import-url", { projectId: pid, url: "https://evil.com/design/ABCDEF1234567/x" })).status).toBe(400);
    expect((await c.post("/api/figma/import-url", { projectId: pid, url: "https://www.figma.com/design/BADKEY12345/x" })).status).toBe(404);
    expect((await c.post("/api/figma/import-url", { projectId: pid, url: "https://www.figma.com/design/RATELIMIT123/x" })).status).toBe(200); // retried after 429

    r = await c.post("/api/figma/import-url", { projectId: pid, url: "https://www.figma.com/design/ABCDEF1234567/Landing?node-id=1-36" });
    expect(r.status).toBe(200);
    const imp = r.data;
    expect(imp.importStatus).toBe("completed");
    expect(imp.sourceMetadata.imageCount).toBe(3);

    // inspector data
    const nodes = (await c.get(`/api/figma/imports/${imp.id}/nodes`)).data;
    const frame = nodes.pages[0].children[0];
    expect(frame.name).toBe("Landing Page");
    const pv = await c.get(`/api/figma/imports/${imp.id}/preview?node=${encodeURIComponent(frame.id)}`);
    expect(pv.status).toBe(200);
    expect(pv.data.files.some((f) => f.path === "index.html")).toBe(true);

    // generate React + Tailwind
    r = await c.post("/api/conversion/generate", { projectId: pid, framework: "react", styling: "tailwind", nodeIds: [frame.id] });
    expect(r.status).toBe(200);
    expect(r.data.version).toBe(1);
    expect(r.data.conversionReport.summary.converted).toBeGreaterThan(10);
    expect(r.data.files.some((f) => f.path === "src/components/FeatureCard.jsx")).toBe(true);
    expect(r.data.files.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"))).toBe(false);
    const v1 = r.data.id;

    // working copy edit
    let wc = (await c.get(`/api/projects/${pid}/files`)).data;
    expect(wc.dirty).toBe(false);
    const btn = wc.files.find((f) => f.path === "src/components/Button.jsx");
    expect((await c.put(`/api/projects/${pid}/files`, { changes: [{ path: "../etc/passwd", content: "x" }] })).status).toBe(400);
    expect((await c.put(`/api/projects/${pid}/files`, { changes: [{ path: btn.path, content: btn.content + "\n// edited" }] })).status).toBe(200);
    // regeneration warns about unsaved edits
    r = await c.post("/api/conversion/generate", { projectId: pid, framework: "nextjs", styling: "css", nodeIds: [frame.id] });
    expect(r.status).toBe(409); expect(r.error.code).toBe("DIRTY_WORKING_COPY");
    // save as a version
    r = await c.post(`/api/projects/${pid}/versions`, { label: "my edit" });
    expect(r.status).toBe(200); expect(r.data.version).toBe(2); expect(r.data.kind).toBe("saved");
    // regenerate as Next + CSS
    r = await c.post("/api/conversion/generate", { projectId: pid, framework: "nextjs", styling: "css", nodeIds: [frame.id] });
    expect(r.status).toBe(200); expect(r.data.version).toBe(3);
    expect(r.data.files.some((f) => f.path === "app/page.js")).toBe(true);

    // history is preserved and restorable
    const versions = (await c.get(`/api/projects/${pid}/versions`)).data;
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
    const old = (await c.get(`/api/projects/${pid}/versions/${v1}?files=1`)).data;
    expect(old.fileContents.find((f) => f.path === "src/components/Button.jsx").content).not.toContain("// edited");
    r = await c.post(`/api/projects/${pid}/restore`, { versionId: v1 });
    expect(r.status).toBe(200); expect(r.data.version).toBe(4); expect(r.data.kind).toBe("restored");
    wc = (await c.get(`/api/projects/${pid}/files`)).data;
    expect(wc.files.some((f) => f.path === "src/App.jsx")).toBe(true);
    expect((await c.get(`/api/projects/${pid}/versions`)).data).toHaveLength(4);
    expect((await c.get(`/api/conversion/${v1}/report`)).data.report.summary).toBeTruthy();

    // ZIP export is real and complete
    const res = await c.req("GET", `/api/projects/${pid}/export`, undefined, { raw: true });
    expect(res.headers.get("content-type")).toBe("application/zip");
    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    const names = Object.keys(zip.files);
    for (const f of ["package.json", "README.md", "index.html", "vite.config.js", "src/main.jsx", "src/App.jsx"]) expect(names).toContain(f);
    expect(names.some((n) => n.startsWith("public/assets/images/") && !n.endsWith("/"))).toBe(true);
    expect(JSON.parse(await zip.file("package.json").async("string")).scripts.build).toBe("vite build");
    const png = await zip.file(names.find((n) => n.startsWith("public/assets/images/") && !n.endsWith("/"))).async("nodebuffer");
    expect(png.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("rejects bad .fig uploads and treats screenshots as references only", async () => {
    const { c } = await registerVerifyLogin("Uploader");
    const ws = (await c.post("/api/workspaces", { name: "U" })).data.id;
    const pid = (await c.post("/api/projects", { workspaceId: ws, name: "P" })).data.id;
    const form = (name, bytes) => { const f = new FormData(); f.append("projectId", pid); f.append("file", new Blob([bytes]), name); return f; };
    let r = await c.req("POST", "/api/figma/upload-fig", form("x.fig", Buffer.from("this is not a fig file, it is plain text padding")));
    expect(r.status).toBe(400); expect(r.error.message).toMatch(/not a Figma|signature/i);
    r = await c.req("POST", "/api/figma/upload-fig", form("x.txt", Buffer.from("fig-kiwi....")));
    expect(r.status).toBe(400);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    r = await c.req("POST", "/api/figma/upload", form("shot.png", Buffer.from("GIF89a-not-an-image")));
    expect(r.status).toBe(400);
    r = await c.req("POST", "/api/figma/upload", form("shot.png", png));
    expect(r.status).toBe(200); expect(r.data.sourceType).toBe("screenshot"); expect(r.data.sourceMetadata.width).toBe(1);
    r = await c.post("/api/conversion/generate", { projectId: pid, framework: "html", styling: "css" });
    expect(r.status).toBe(400); expect(r.error.message).toMatch(/visual references/i);
  });
});
