"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle, Loader2, Mail } from "lucide-react";
import { enablePushNotifications } from "@/lib/push-client";
import { Section } from "./section";
import { useNotificationPreferences } from "./use-notification-preferences";

export function NotificationsSection() {
  const { user: clerkUser } = useUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  const { notifPrefs, setNotifPrefs, saved, mutation } = useNotificationPreferences();
  const [pushStatus, setPushStatus] = useState<"idle" | "enabling" | "enabled">("idle");
  const [pushError, setPushError] = useState<string | null>(null);

  async function handleEnablePush() {
    setPushStatus("enabling");
    setPushError(null);
    try {
      await enablePushNotifications();
      setPushStatus("enabled");
    } catch (error) {
      setPushStatus("idle");
      setPushError(error instanceof Error ? error.message : "Failed to enable notifications.");
    }
  }

  return (
    <Section title="Notifications">
      <div className="mb-4 flex items-start gap-2.5">
        <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-foreground/80">
          Email alerts go to{" "}
          <span className="text-foreground font-medium">{email ?? "your account email"}</span> when
          a type below is on. They also appear in the in-app notification bell.
        </p>
      </div>

      <div className="space-y-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/80">Job match alerts</span>
          <button
            onClick={() => setNotifPrefs((p) => ({ ...p, jobMatches: !p.jobMatches }))}
            className={cn(
              "w-9 h-5 rounded-full relative transition-colors shrink-0",
              notifPrefs.jobMatches ? "bg-blue-500" : "bg-muted border border-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                notifPrefs.jobMatches && "translate-x-4"
              )}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/80">Follow-up reminders</span>
          <button
            onClick={() =>
              setNotifPrefs((p) => ({ ...p, followUpReminders: !p.followUpReminders }))
            }
            className={cn(
              "w-9 h-5 rounded-full relative transition-colors shrink-0",
              notifPrefs.followUpReminders ? "bg-blue-500" : "bg-muted border border-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                notifPrefs.followUpReminders && "translate-x-4"
              )}
            />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Quiet hours (no device push during this window — email still sends)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={notifPrefs.quietHoursStart}
              onChange={(e) => setNotifPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-muted-foreground/70">to</span>
            <input
              type="time"
              value={notifPrefs.quietHoursEnd}
              onChange={(e) => setNotifPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm text-foreground/80">Also notify on this device</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional web push. On iPhone/iPad, add this app to your Home Screen first.
                </p>
              </div>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={pushStatus !== "idle"}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:text-muted-foreground transition-colors shrink-0"
            >
              {pushStatus === "enabling"
                ? "Enabling…"
                : pushStatus === "enabled"
                  ? "Enabled"
                  : "Enable"}
            </button>
          </div>
          {pushError && <p className="text-xs text-red-400 mt-2">{pushError}</p>}
        </div>

        <button
          onClick={() => mutation.mutate(notifPrefs)}
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="h-4 w-4 text-green-300" />
          ) : null}
          {saved ? "Saved!" : mutation.isPending ? "Saving…" : "Save notification settings"}
        </button>
      </div>
    </Section>
  );
}
