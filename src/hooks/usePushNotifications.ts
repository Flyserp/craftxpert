import { useCallback, useEffect, useState } from "react";

export interface PushState {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  request: () => Promise<NotificationPermission>;
  subscribe: (vapidPublicKey?: string) => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<boolean>;
}

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; ++i) view[i] = raw.charCodeAt(i);
  return buf;
}

export function usePushNotifications(): PushState {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, [supported]);

  const request = useCallback(async () => {
    if (!supported) return "denied" as NotificationPermission;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  }, [supported]);

  const subscribe = useCallback(
    async (vapidPublicKey?: string) => {
      if (!supported) return null;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setSubscribed(true); return existing; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
          ? urlBase64ToUint8Array(vapidPublicKey)
          : undefined,
      });
      setSubscribed(true);
      return sub;
    },
    [supported],
  );

  const unsubscribe = useCallback(async () => {
    if (!supported) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const ok = sub ? await sub.unsubscribe() : true;
    setSubscribed(false);
    return ok;
  }, [supported]);

  return { supported, permission, subscribed, request, subscribe, unsubscribe };
}