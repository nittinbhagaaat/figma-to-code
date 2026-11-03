"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-card";
import { Field } from "@/components/layout/form-field";
import { api } from "@/lib/client-api";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").regex(/[a-z]/, "Include a lowercase letter").regex(/[A-Z]/, "Include an uppercase letter").regex(/\d/, "Include a number"),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export default function Page() {
  const [done, setDone] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = async (values) => {
    try { const { confirm: _c, ...payload } = values; setDone(await api.post("/api/auth/register", payload)); } catch (e) { toast.error(e.message); }
  };
  if (done) return (
    <AuthShell title="Check your inbox" subtitle={`We sent a verification link to ${done.email}.`} footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>}>
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm"><MailCheck className="mt-0.5 size-5 text-primary" /><p className="text-muted-foreground">Open the link to activate your account. {!done.emailDelivered && "No email provider is configured on this server, so the message was written to the server console instead."}</p></div>
    </AuthShell>
  );
  return (
    <AuthShell title="Create your account" subtitle="Free. No credit card, no limits." footer={<>Already have an account? <Link className="font-medium text-foreground hover:underline" href="/login">Sign in</Link></>}>
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field id="name" label="Full name" autoComplete="name" register={register("name")} error={errors.name} />
        <Field id="email" label="Email" type="email" autoComplete="email" register={register("email")} error={errors.email} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower case and a number." register={register("password")} error={errors.password} />
        <Field id="confirm" label="Confirm password" type="password" autoComplete="new-password" register={register("confirm")} error={errors.confirm} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}Create account</Button>
      </form>
    </AuthShell>
  );
}
