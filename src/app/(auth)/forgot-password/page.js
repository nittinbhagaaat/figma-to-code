"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-card";
import { Field } from "@/components/layout/form-field";
import { api } from "@/lib/client-api";

export default function Page() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();
  const onSubmit = async ({ email }) => { try { await api.post("/api/auth/forgot-password", { email }); setSent(true); } catch (e) { toast.error(e.message); } };
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link that expires in one hour." footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>}>
      {sent ? <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">If an account exists for that address, a reset link is on its way.</p> : (
        <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field id="email" label="Email" type="email" required autoComplete="email" register={register("email")} />
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
