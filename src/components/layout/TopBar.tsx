"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { SearchDialog } from "./SearchDialog";

export interface ShellStatus {
  todayLabel: string;
  windowLabel: string;
  lastSyncedAt: string | null;
  lastSyncedLabel: string | null;
  lastRefreshFailed: boolean;
  lastDeliveryLabel: string | null;
  telegramConnected: boolean;
  digestEnabled: boolean;
  nextRunLabel: string | null;
}

export function TopBar({ user, status }: { user: { email: string | null; displayName: string | null }; status: ShellStatus }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePathname();
  const automationOk = status.telegramConnected && status.digestEnabled && !status.lastRefreshFailed;
  const initials = (user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar">
            <SheetHeader>
              <SheetTitle>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-3" aria-label="Main">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    path.startsWith(href) && "bg-sidebar-accent text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" /> {label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/discover" className="lg:hidden" aria-label="Home">
          <Logo collapsed />
        </Link>

        <div className="hidden min-w-0 flex-col md:flex">
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan">New this week</span>
          <span className="truncate text-sm text-foreground/90">{status.windowLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden text-xs text-muted-foreground xl:inline">{status.todayLabel}</span>

          <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} className="gap-2 text-muted-foreground" aria-label="Search titles">
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-border px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Automation status" className="relative">
                <Bot className="size-[18px]" />
                <span className={cn("absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-background", automationOk ? "bg-watch" : status.lastRefreshFailed ? "bg-skip" : "bg-maybe")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-sm">
              <p className="font-medium">Automation</p>
              <dl className="mt-3 space-y-2 text-xs">
                <Row k="Release data" v={status.lastSyncedLabel ? `Synced ${status.lastSyncedLabel}` : "Never synced"} bad={status.lastRefreshFailed} />
                <Row k="Telegram" v={status.telegramConnected ? "Connected" : "Not connected"} bad={!status.telegramConnected} />
                <Row k="Weekly digest" v={status.digestEnabled ? "On" : "Off"} bad={!status.digestEnabled} />
                <Row k="Next scheduled run" v={status.nextRunLabel ?? "—"} />
                <Row k="Last delivery" v={status.lastDeliveryLabel ?? "None yet"} />
              </dl>
              <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                <Link href="/settings">Open settings</Link>
              </Button>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Profile menu" className="rounded-full">
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet/80 to-cyan/60 text-sm font-semibold text-white">
                  {initials}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal">
                <span className="block text-sm">{user.displayName ?? "Your account"}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/preferences">
                  <User /> My preferences
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action="/auth/signout" method="post">
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <LogOut /> Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("text-right", bad && "text-maybe")}>{v}</dd>
    </div>
  );
}
