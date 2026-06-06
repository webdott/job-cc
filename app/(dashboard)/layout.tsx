"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Home, Layers, Search, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
        const data = (await res.json()) as { hasResume: boolean };
        if (!data.hasResume) {
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
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-border bg-card shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
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
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>

        {/* Bottom tab bar — mobile only */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors",
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
