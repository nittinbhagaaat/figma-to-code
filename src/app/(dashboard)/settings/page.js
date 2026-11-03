"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/layout/shared";

export default function SettingsPage() {
  const { data, reload } = useApi("/api/auth/me");
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // theme is only known on the client
  useEffect(() => { if (data?.user) setName(data.user.name); }, [data]);
  const run = async (key, fn, msg) => { setBusy(key); try { await fn(); toast.success(msg); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(""); } };
  const u = data?.user;
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Your profile, security and integrations." />
      <Card><CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input value={u?.email || ""} disabled /></div>
        <Button disabled={busy === "profile" || !name.trim() || name === u?.name} onClick={() => run("profile", () => api.patch("/api/account", { name }), "Profile saved")}>{busy === "profile" && <Loader2 className="animate-spin" />}Save</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader><CardContent>
        <Select value={mounted ? theme : "system"} onValueChange={setTheme}><SelectTrigger className="w-48" aria-label="Theme"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">System</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" />Figma access token</CardTitle>
        <CardDescription>Needed to import by URL. Create a personal access token in Figma → Settings → Security with the <b>File content: read</b> scope. It is encrypted at rest and never sent back to your browser.</CardDescription></CardHeader><CardContent className="space-y-3">
        {u?.hasFigmaToken && <p className="flex items-center gap-2 text-sm text-success"><ShieldCheck className="size-4" />A token is saved. Paste a new one to replace it.</p>}
        <Input type="password" autoComplete="off" placeholder="figd_…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Figma personal access token" />
        <div className="flex gap-2">
          <Button disabled={busy === "token" || token.length < 20} onClick={() => run("token", async () => { await api.put("/api/figma/token", { token }); setToken(""); }, "Token saved")}>{busy === "token" && <Loader2 className="animate-spin" />}Save token</Button>
          {u?.hasFigmaToken && <Button variant="outline" onClick={() => run("rm", () => api.del("/api/figma/token"), "Token removed")}>Remove</Button>}
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Change password</CardTitle><CardDescription>Changing your password signs out your other sessions.</CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="new">New password</Label><Input id="new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
        <Button disabled={busy === "pw" || !pw.current || pw.next.length < 8} onClick={() => run("pw", async () => { await api.post("/api/account/password", pw); setPw({ current: "", next: "" }); }, "Password changed")}>{busy === "pw" && <Loader2 className="animate-spin" />}Update password</Button>
      </CardContent></Card>
    </div>
  );
}
