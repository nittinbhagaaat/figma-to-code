import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function Field({ label, id, error, hint, register, ...props }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...register} {...props} />
      {error ? <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error.message}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
