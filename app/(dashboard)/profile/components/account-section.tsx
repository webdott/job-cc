"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { User, LogOut } from "lucide-react";
import { Section } from "./section";

export function AccountSection() {
  const { user: clerkUser } = useUser();

  return (
    <Section title="Account">
      <div className="flex items-center gap-3 mb-4">
        {clerkUser?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clerkUser.imageUrl} alt="Avatar" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="h-5 w-5 text-blue-400" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{clerkUser?.fullName ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {clerkUser?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>
      <SignOutButton>
        <button className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </SignOutButton>
    </Section>
  );
}
