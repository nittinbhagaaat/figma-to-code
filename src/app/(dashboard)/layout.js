import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";
export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}
