import { Bookmark, CalendarRange, Compass, History, Settings, SlidersHorizontal, type LucideIcon } from "lucide-react";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/this-week", label: "This Week", icon: CalendarRange },
  { href: "/watchlist", label: "My Watchlist", icon: Bookmark },
  { href: "/preferences", label: "My Preferences", icon: SlidersHorizontal },
  { href: "/digest-history", label: "Digest History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];
