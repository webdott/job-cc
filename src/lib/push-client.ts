export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// Web Push on iOS Safari requires iOS 16.4+ AND the app installed to the
// home screen — `PushManager` is undefined in an ordinary Safari tab, so
// isPushSupported() alone can't tell "unsupported browser" from "unsupported
// context"; this distinguishes the latter so we can point the user at the
// actual fix (Add to Home Screen) instead of a dead end.
export function needsIosHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  if (!isIos) return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(Array.from(rawData).map((char) => char.charCodeAt(0)));
}

export async function enablePushNotifications(): Promise<void> {
  if (needsIosHomeScreenInstall()) {
    throw new Error(
      "On iPhone/iPad, add this app to your Home Screen first (Share → Add to Home Screen), then enable notifications from there."
    );
  }
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error("Push notifications aren't configured for this app yet.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });

  if (!res.ok) {
    throw new Error("Failed to save your subscription. Please try again.");
  }
}
