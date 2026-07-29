"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

export function StepNotifications() {
  const router = useRouter();

  async function handleEnableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        router.push("/");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    } catch (error) {
      // Fail silently — notifications are optional
      console.error("Failed to enable notifications", error);
    }
    router.push("/");
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

      <button
        onClick={handleEnableNotifications}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-colors mb-3"
      >
        Enable notifications
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
