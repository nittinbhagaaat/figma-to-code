"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell } from "@/components/layout/auth-card";
import { Field } from "@/components/layout/form-field";
import { api } from "@/lib/client-api";

const schema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password"), remember: z.boolean().optional() });

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [unverified, setUnverified] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting, } } = useForm({ resolver: zodResolver(schema), defaultValues: { remember: true } });
  const email = watch("email");
  const onSubmit = async (values) => {
    setUnverified(false);
    try {
      await api.post("/api/auth/login", values);
      const next = sp.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (e) {
      if (e.code === "EMAIL_UNVERIFIED") setUnverified(true);
      toast.error(e.message);
    }
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspace." footer={<>New here? <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/register">Create an account</Link></>}>
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" register={register("email")} error={errors.email} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" register={register("password")} error={errors.password} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked onCheckedChange={(v) => setValue("remember", !!v)} />Keep me signed in</label>
          <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}Sign in</Button>
        {unverified && (
          <Button type="button" variant="outline" className="w-full" onClick={async () => { await api.post("/api/auth/resend-verification", { email }).catch(() => {}); toast.success("If the account exists, a new verification email was sent."); }}>
            Resend verification email
          </Button>
        )}
      </form>
    </AuthShell>
  );
}
