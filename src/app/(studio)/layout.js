import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth/session";

export const dynamic = "force-dynamic";
export default async function StudioLayout({ children }) {
  if (!(await getCurrentUser())) redirect("/login");
  return children;
}
