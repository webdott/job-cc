"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { Section } from "./section";

const THEME_OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Section title="Appearance">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground/80">Theme</span>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              title={label}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                theme === value
                  ? "bg-slate-700 text-white"
                  : "text-muted-foreground/70 hover:text-foreground/80"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
