"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-card";
import { Field } from "@/components/layout/form-field";
import { api } from "@/lib/client-api";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters").regex(/[a-z]/, "Include a lowercase letter").regex(/[A-Z]/, "Include an uppercase letter").regex(/\d/, "Include a number"),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = async ({ password }) => {
    try { await api.post("/api/auth/reset-password", { token, password }); toast.success("Password updated. Sign in with your new password."); router.replace("/login"); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <AuthShell title="Choose a new password" subtitle="All other sessions will be signed out." footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>}>
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field id="password" label="New password" type="password" autoComplete="new-password" register={register("password")} error={errors.password} />
        <Field id="confirm" label="Confirm password" type="password" autoComplete="new-password" register={register("confirm")} error={errors.confirm} />
        <Button type="submit" className="w-full" disabled={isSubmitting || !token}>{isSubmitting && <Loader2 className="animate-spin" />}Update password</Button>
      </form>
    </AuthShell>
  );
}
