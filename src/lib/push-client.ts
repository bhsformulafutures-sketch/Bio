/**
 * Client-side glue for browser push. Everything is defensive — push is a
 * progressive enhancement, so each call degrades gracefully when the browser
 * (or the server config) can't support it.
 */

export interface PushInfo {
  configured: boolean;
  publicKey: string | null;
}

/** Does this browser support the APIs we need? */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Ask the server whether push is wired up + for the VAPID public key. */
export async function getPushInfo(): Promise<PushInfo> {
  try {
    const res = await fetch("/api/push");
    if (!res.ok) return { configured: false, publicKey: null };
    return (await res.json()) as PushInfo;
  } catch {
    return { configured: false, publicKey: null };
  }
}

/** Register the service worker (idempotent) and return its registration. */
async function register(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register("/sw.js");
}

/** True if this browser already holds an active push subscription. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/**
 * Turn notifications on for this browser: register the SW, request permission,
 * create a push subscription, and hand it to the server. Returns a status the
 * UI can react to.
 */
export async function enablePush(
  publicKey: string
): Promise<"enabled" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await register();
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
    return res.ok ? "enabled" : "error";
  } catch (error) {
    console.error("enablePush failed:", error);
    return "error";
  }
}

/** Turn notifications off for this browser. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch (error) {
    console.error("disablePush failed:", error);
  }
}

/** VAPID keys are URL-safe base64; PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
