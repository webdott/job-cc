"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <ClerkSignOutButton>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        className={cn(
          "flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          className
        )}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </ClerkSignOutButton>
  );
}
