import webpush from "web-push";
import { prisma } from "@/lib/prisma";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "admin@example.com"}`,
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

export type NotificationType = "job_match" | "follow_up_reminder";

interface NotificationPrefs {
  jobMatches?: boolean;
  followUpReminders?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface NotifyUserInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  preferences: unknown;
  subscriptions: PushSubscriptionRecord[];
}

const TOGGLE_KEY: Record<NotificationType, keyof NotificationPrefs> = {
  job_match: "jobMatches",
  follow_up_reminder: "followUpReminders",
};

function inQuietHours(prefs: NotificationPrefs, now: Date): boolean {
  const { quietHoursStart, quietHoursEnd } = prefs;
  if (!quietHoursStart || !quietHoursEnd) return false;

  const [startH, startM] = quietHoursStart.split(":").map(Number);
  const [endH, endM] = quietHoursEnd.split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (start === end) return false;
  // Window wraps past midnight (e.g. 22:00-07:00)
  return start < end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;
}

/**
 * Records a notification in the in-app history (respecting the per-type toggle)
 * and pushes it to the user's devices unless it falls inside their quiet hours.
 */
export async function notifyUser({
  userId,
  type,
  title,
  body,
  url,
  preferences,
  subscriptions,
}: NotifyUserInput): Promise<{ created: boolean; pushed: number }> {
  const prefs = (preferences as { notifications?: NotificationPrefs } | null)?.notifications ?? {};
  const enabled = prefs[TOGGLE_KEY[type]] ?? true;
  if (!enabled) return { created: false, pushed: 0 };

  await prisma.notification.create({ data: { userId, type, title, body, url } });

  if (inQuietHours(prefs, new Date())) return { created: true, pushed: 0 };

  let pushed = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, icon: "/icons/icon-192.png", url })
      );
      pushed++;
    } catch {
      // Subscription may be expired — remove it
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }

  return { created: true, pushed };
}
