import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  type PreferencesResponse,
} from "../types";

/** Shares the `["user-preferences"]` query cache with useJobPreferences — one fetch, two consumers. */
export function useNotificationPreferences() {
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery<PreferencesResponse>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences");
      return res.json() as Promise<PreferencesResponse>;
    },
  });

  useEffect(() => {
    if (!data?.preferences) return;
    setNotifPrefs({
      jobMatches: data.preferences.notifications?.jobMatches ?? true,
      followUpReminders: data.preferences.notifications?.followUpReminders ?? true,
      quietHoursStart: data.preferences.notifications?.quietHoursStart ?? "",
      quietHoursEnd: data.preferences.notifications?.quietHoursEnd ?? "",
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (p: NotificationPrefs) => {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifications: {
            jobMatches: p.jobMatches,
            followUpReminders: p.followUpReminders,
            quietHoursStart: p.quietHoursStart || null,
            quietHoursEnd: p.quietHoursEnd || null,
          },
        }),
      });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return { notifPrefs, setNotifPrefs, saved, mutation };
}
