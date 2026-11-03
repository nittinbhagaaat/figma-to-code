"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-card";
import { api } from "@/lib/client-api";

export function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState({ status: token ? "loading" : "error", message: token ? "" : "This verification link is missing its token." });
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // tokens are single-use; never submit twice (React strict mode)
    api.post("/api/auth/verify-email", { token }).then(() => setState({ status: "ok" })).catch((e) => setState({ status: "error", message: e.message }));
  }, [token]);
  return (
    <AuthShell title={state.status === "ok" ? "Email verified" : state.status === "error" ? "Verification failed" : "Verifying…"}>
      <div className="flex flex-col items-start gap-4">
        {state.status === "loading" && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        {state.status === "ok" && <><p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-5 text-success" />Your account is active.</p><Button asChild><Link href="/login">Continue to sign in</Link></Button></>}
        {state.status === "error" && <><p className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="size-5 text-destructive" />{state.message}</p><Button asChild variant="outline"><Link href="/login">Back to sign in</Link></Button></>}
      </div>
    </AuthShell>
  );
}
