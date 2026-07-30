"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Home, Layers, Search, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/pipeline", label: "Pipeline", icon: Layers },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/profile", label: "Profile", icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Create user record on first load + redirect to onboarding if no resume
    async function bootstrap() {
      try {
        const res = await fetch("/api/user/me");
        if (!res.ok) return;
        const data = (await res.json()) as { hasResume: boolean; needsByocSetup: boolean };
        if (!data.hasResume || data.needsByocSetup) {
          router.push("/onboarding");
        }
      } catch {
        // Fail silently — don't block the app
      }
    }
    bootstrap();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Not position:fixed — iOS standalone clips fixed roots to the lying viewport
    // and leaves a black strip under the tab bar. Height comes from --app-height
    // (100vh in installed PWA, 100dvh in browser); see ios-pwa-viewport.ts.
    <div className="flex h-[var(--app-height,100dvh)] overflow-hidden bg-background text-foreground">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-border bg-card shrink-0">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <span className="text-lg font-semibold tracking-tight">
            Job<span className="text-blue-500">CC</span>
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top bar — pt-safe-top keeps content below the iOS status bar in standalone PWA */}
        <header className="shrink-0 border-b border-border pt-safe-top bg-card">
          <div className="flex h-[55px] items-center justify-between gap-1 px-4 md:px-6">
            <span className="text-lg font-semibold tracking-tight md:hidden">
              Job<span className="text-blue-500">CC</span>
            </span>
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {/* Enter-only: AnimatePresence mode="wait" can leave App Router navigations stuck blank */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>

        {/* In-flow (not fixed): avoids iOS fixed-bar misposition until scroll */}
        <nav
          className="z-50 shrink-0 border-t border-border bg-card md:hidden"
          style={{ paddingBottom: "var(--app-bottom-inset, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex h-16 items-center justify-around px-2">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors",
                  pathname === href ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
