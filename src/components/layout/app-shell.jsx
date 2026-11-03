"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Braces, FolderKanban, LayoutDashboard, LogOut, Moon, Settings, Sun, Users, Building2, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { timeAgo } from "@/components/layout/shared";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun className="size-4 dark:hidden" /><Moon className="hidden size-4 dark:block" /></Button>;
}

export function WorkspaceSwitcher() {
  const { data: list } = useApi("/api/workspaces");
  const { workspaceId, setWorkspaceId } = useWorkspaceStore();
  useEffect(() => { if (list?.length && !list.some((w) => w.id === workspaceId)) setWorkspaceId(list[0].id); }, [list, workspaceId, setWorkspaceId]);
  if (!list) return <div className="h-9 animate-pulse rounded-md bg-muted" />;
  if (!list.length) return <Button asChild variant="outline" size="sm" className="w-full"><Link href="/workspaces">Create a workspace</Link></Button>;
  return (
    <Select value={workspaceId || undefined} onValueChange={setWorkspaceId}>
      <SelectTrigger className="w-full bg-background" aria-label="Switch workspace"><SelectValue placeholder="Workspace" /></SelectTrigger>
      <SelectContent>{list.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Notifications() {
  const { data, reload } = useApi("/api/notifications");
  const router = useRouter();
  return (
    <Popover onOpenChange={(o) => o && reload()}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Notifications" className="relative"><Bell className="size-4" />{data?.unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-medium">Notifications</span>{data?.unread > 0 && <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={async () => { await api.patch("/api/notifications", { all: true }); reload(); }}><Check className="size-3" />Mark all read</button>}</div>
        <div className="max-h-80 overflow-y-auto">
          {!data?.items?.length ? <p className="p-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p> : data.items.map((n) => (
            <button key={n.id} className={cn("block w-full border-b px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent", !n.read && "bg-primary/5")} onClick={async () => { await api.patch("/api/notifications", { id: n.id }); if (n.link) router.push(n.link); reload(); }}>
              <p>{n.message}</p><p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </button>))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => { await api.post("/api/auth/logout").catch(() => {}); router.replace("/login"); router.refresh(); };
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-muted/30 p-3 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 text-base font-semibold"><span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Braces className="size-4" /></span>Figma2Code</Link>
        <div className="mt-4 px-1"><WorkspaceSwitcher /></div>
        <nav className="mt-4 flex flex-1 flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", active && "bg-accent font-medium text-foreground")}><Icon className="size-4" />{label}</Link>;
          })}
        </nav>
        <p className="px-2 pb-1 text-xs text-muted-foreground">Deterministic engine · no AI</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur md:justify-end">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold md:hidden"><Braces className="size-5 text-primary" />Figma2Code</Link>
          <div className="flex items-center gap-1">
            <ThemeToggle /><Notifications />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2 px-2" aria-label="Account menu"><Avatar className="size-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel><p className="truncate text-sm">{user.name}</p><p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/settings"><Settings />Settings</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={logout}><LogOut />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden" aria-label="Main mobile">
          {NAV.map(({ href, label }) => <Link key={href} href={href} className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground", pathname.startsWith(href) && "bg-accent text-foreground")}>{label}</Link>)}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
