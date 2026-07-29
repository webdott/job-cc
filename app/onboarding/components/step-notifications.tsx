"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { enablePushNotifications } from "@/lib/push-client";

export function StepNotifications() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  async function handleEnableNotifications() {
    setEnabling(true);
    setError(null);
    try {
      await enablePushNotifications();
      router.push("/");
    } catch (err) {
      // Notifications are optional — let the user retry or skip rather than
      // silently redirecting past an error they'd want to know about.
      setEnabling(false);
      setError(err instanceof Error ? err.message : "Failed to enable notifications.");
    }
  }

  return (
    <div className="text-center">
      <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Bell className="h-7 w-7 text-blue-400" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">Stay in the loop</h2>
      <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
        Get a daily digest of your top job matches, follow-up reminders, and interview alerts — all
        pushed straight to your device.
      </p>

      <ul className="text-left space-y-2 mb-6">
        {[
          "📬 Daily job digest every morning",
          "⏰ Follow-up reminders when you haven't heard back",
          "🎯 Interview prep reminders",
          "📊 Weekly application summary",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <button
        onClick={handleEnableNotifications}
        disabled={enabling}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors mb-3"
      >
        {enabling ? "Enabling…" : "Enable notifications"}
      </button>
      <button
        onClick={() => router.push("/")}
        className="w-full text-muted-foreground/70 hover:text-muted-foreground text-sm py-2 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}
