"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center", className)}>
      {Icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted"><Icon className="size-5 text-muted-foreground" /></div>}
      <h3 className="font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const roleStyle = { owner: "bg-primary/10 text-primary", admin: "bg-amber-500/10 text-amber-600 dark:text-amber-400", editor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", viewer: "bg-muted text-muted-foreground" };
export const RoleBadge = ({ role }) => <Badge variant="secondary" className={cn("capitalize", roleStyle[role])}>{role}</Badge>;

export function ListSkeleton({ rows = 3, className }) {
  return <div className={cn("space-y-3", className)}>{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
}
export const ErrorNote = ({ error, retry }) => (
  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="text-destructive">{error?.message || "Something went wrong"}</p>{retry && <Button variant="outline" size="sm" className="mt-3" onClick={retry}>Try again</Button>}</div>
);

/** Confirmation dialog for destructive actions. onConfirm may be async. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""} disabled={busy}
            onClick={async (e) => { e.preventDefault(); setBusy(true); try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); } }}>
            {busy && <Loader2 className="animate-spin" />}{confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export const timeAgo = (d) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  const t = [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]].find(([n]) => s >= n);
  return t ? `${Math.floor(s / t[0])}${t[1]} ago` : "just now";
};
