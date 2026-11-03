import { z } from "zod";
import { badRequest } from "@/lib/errors";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
export const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");
export const roleEnum = z.enum(["admin", "editor", "viewer"]);
export const frameworkEnum = z.enum(["html", "react", "nextjs"]);
export const stylingEnum = z.enum(["css", "tailwind"]);

/** Parses data with a zod schema, throwing a 400 AppError with field-level details. */
export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = {};
    for (const i of r.error.issues) fields[i.path.join(".") || "_"] ??= i.message;
    throw badRequest(Object.values(fields)[0] || "Invalid request", fields);
  }
  return r.data;
}
