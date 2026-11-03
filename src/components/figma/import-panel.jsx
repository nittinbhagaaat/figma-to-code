"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { FileUp, ImageIcon, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client-api";

function Drop({ accept, onFile, busy, label, hint, icon: Icon }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div role="button" tabIndex={0} onClick={() => ref.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors hover:bg-accent/40 ${over ? "border-primary bg-primary/5" : ""}`}>
      {busy ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <Icon className="size-6 text-muted-foreground" />}
      <p className="text-sm font-medium">{busy ? "Uploading and parsing…" : label}</p><p className="text-xs text-muted-foreground">{hint}</p>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </div>
  );
}

export function ImportPanel({ projectId, hasToken, onImported }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [vp, setVp] = useState({ width: "1440", height: "900" });
  const run = async (key, fn) => { setBusy(key); try { const imp = await fn(); toast.success(imp.warnings?.length ? `Imported with ${imp.warnings.length} warning(s)` : "Design imported"); onImported(imp); } catch (e) { toast.error(e.message); } finally { setBusy(""); } };
  const upload = (path, extra = {}) => (file) => run(path, () => { const f = new FormData(); f.append("projectId", projectId); f.append("file", file); Object.entries(extra).forEach(([k, v]) => f.append(k, v)); return api.post(path, f); });
  return (
    <Tabs defaultValue="url">
      <TabsList><TabsTrigger value="url"><Link2 className="size-4" />Figma URL</TabsTrigger><TabsTrigger value="fig"><FileUp className="size-4" />.fig file</TabsTrigger><TabsTrigger value="shot"><ImageIcon className="size-4" />Screenshot</TabsTrigger></TabsList>
      <TabsContent value="url" className="mt-4 space-y-3">
        {!hasToken && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Add a Figma personal access token in <Link href="/settings" className="font-medium underline">Settings</Link> first. It stays on the server.</p>}
        <form onSubmit={(e) => { e.preventDefault(); run("url", () => api.post("/api/figma/import-url", { projectId, url })); }} className="space-y-3">
          <Label htmlFor="figma-url">Figma design URL</Label>
          <div className="flex gap-2"><Input id="figma-url" placeholder="https://www.figma.com/design/FILE_KEY/Name" value={url} onChange={(e) => setUrl(e.target.value)} required /><Button type="submit" disabled={busy === "url" || !hasToken}>{busy === "url" && <Loader2 className="animate-spin" />}Import</Button></div>
          <p className="text-xs text-muted-foreground">Fetches the file structure, image fills and vector exports through the Figma REST API.</p>
        </form>
      </TabsContent>
      <TabsContent value="fig" className="mt-4 space-y-2">
        <Drop accept=".fig" busy={busy === "/api/figma/upload-fig"} icon={FileUp} label="Drop a .fig file or click to browse" hint="Parsed on the server. Unsupported features are reported, never silently dropped." onFile={upload("/api/figma/upload-fig")} />
      </TabsContent>
      <TabsContent value="shot" className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm"><div className="space-y-1.5"><Label htmlFor="vw">Viewport width</Label><Input id="vw" inputMode="numeric" value={vp.width} onChange={(e) => setVp({ ...vp, width: e.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="vh">Viewport height</Label><Input id="vh" inputMode="numeric" value={vp.height} onChange={(e) => setVp({ ...vp, height: e.target.value })} /></div></div>
        <Drop accept="image/png,image/jpeg,image/webp" busy={busy === "/api/figma/upload"} icon={ImageIcon} label="Drop a PNG, JPG or WebP" hint="Stored as a visual reference only." onFile={(f) => upload("/api/figma/upload", { viewportWidth: vp.width, viewportHeight: vp.height })(f)} />
        <p className="text-xs text-muted-foreground">A screenshot has no layers, components or layout data, so it is <b>not</b> converted to code. It is kept as a reference next to your project.</p>
      </TabsContent>
    </Tabs>
  );
}
