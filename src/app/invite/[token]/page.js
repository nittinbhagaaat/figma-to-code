"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-card";
import { RoleBadge } from "@/components/layout/shared";
import { api } from "@/lib/client-api";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function InvitePage({ params }) {
  const { token } = use(params);
  const router = useRouter();
  const [invite, setInvite] = useState(null);
  const [me, setMe] = useState(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setWs = useWorkspaceStore((s) => s.setWorkspaceId);
  useEffect(() => {
    api.get(`/api/invitations/preview?token=${encodeURIComponent(token)}`).then(setInvite).catch((e) => setError(e.message));
    api.get("/api/auth/me").then((d) => setMe(d.user)).catch(() => setMe(null));
  }, [token]);
  const next = encodeURIComponent(`/invite/${token}`);
  const accept = async () => {
    setBusy(true);
    try { const r = await api.post("/api/invitations/accept", { token }); setWs(r.workspaceId); toast.success("You joined the workspace"); router.replace(`/workspaces/${r.workspaceId}`); }
    catch (e) { toast.error(e.message); setError(e.message); } finally { setBusy(false); }
  };
  if (error && !invite) return <AuthShell title="Invitation unavailable" subtitle={error}><Button asChild variant="outline"><Link href="/login">Go to sign in</Link></Button></AuthShell>;
  if (!invite || me === undefined) return <AuthShell title="Loading invitation…"><Loader2 className="size-6 animate-spin text-muted-foreground" /></AuthShell>;
  const wrongUser = me && me.email !== invite.email;
  return (
    <AuthShell title={`Join ${invite.workspaceName}`} subtitle={`This invitation was sent to ${invite.email}.`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span className="text-muted-foreground">Your role</span><RoleBadge role={invite.role} /></div>
        {invite.status !== "pending" ? <p className="flex items-center gap-2 text-sm text-destructive"><MailWarning className="size-4" />This invitation is {invite.status}. Ask for a new one.</p>
          : !me ? (<div className="flex flex-col gap-2"><Button asChild><Link href={`/login?next=${next}`}>Sign in to accept</Link></Button><Button asChild variant="outline"><Link href={`/register?next=${next}`}>Create an account</Link></Button><p className="text-xs text-muted-foreground">Use {invite.email} so the invitation matches your account.</p></div>)
          : wrongUser ? <p className="text-sm text-destructive">You&apos;re signed in as {me.email}. Sign out and use {invite.email} to accept.</p>
          : <Button onClick={accept} disabled={busy} className="w-full">{busy && <Loader2 className="animate-spin" />}Accept invitation</Button>}
      </div>
    </AuthShell>
  );
}
