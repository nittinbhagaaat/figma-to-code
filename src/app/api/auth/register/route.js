import { z } from "zod";
import { route } from "@/lib/api";
import { email, password } from "@/lib/validation";
import { registerUser } from "@/services/auth";

const schema = z.object({ name: z.string().trim().min(1, "Name is required").max(80), email, password });
export const POST = route({ auth: false, schema, limit: { key: "register", limit: 10, windowSec: 3600 } }, async ({ body }) => {
  const { user, emailDelivered } = await registerUser(body);
  return { id: String(user._id), email: user.email, emailDelivered };
});
