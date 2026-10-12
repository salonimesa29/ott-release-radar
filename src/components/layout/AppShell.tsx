"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { TopBar, type ShellStatus } from "./TopBar";

const KEY = "radar-sidebar-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(KEY, cb);
    window.removeEventListener("storage", cb);
  };
}

export function AppShell({ children, user, status }: { children: React.ReactNode; user: { email: string | null; displayName: string | null }; status: ShellStatus }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const path = usePathname();
  const toggle = () => {
    try {
      localStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(KEY));
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300 lg:flex",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "px-5")}>
          <Link href="/discover" aria-label="OTT Release Radar home">
            <Logo collapsed={collapsed} />
          </Link>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3" aria-label="Main">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = path === href || path.startsWith(`${href}/`);
            const link = (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                  active && "bg-sidebar-accent text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-violet to-cyan" />}
                <Icon className={cn("size-[18px] shrink-0", active && "text-violet")} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </nav>
        <div className={cn("p-3", collapsed && "flex justify-center")}>
          <Button variant="ghost" size="sm" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="text-muted-foreground">
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} status={status} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
