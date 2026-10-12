import { useEffect, useRef } from "react";
import { useAuth } from "./auth";
import { patchSettingsData, useSettings } from "./queries";
import { useQueryClient } from "@tanstack/react-query";

export const VAPID_PUBLIC_KEY =
  "BLT2LtJrdTlaO3JoeGp_dUAnjMnXv99sDkD6mjtqIIO8YsGKYCEfmO5NlS51JkMUG4r8--5Zp-P2TduXjaFyEN0";

export type SubJSON = { endpoint?: string; keys?: Record<string, string> };

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Reminders are on unless explicitly turned off (legacy: a saved `push`). */
export function remindersOn(data: Record<string, unknown>): boolean {
  if (typeof data.remindersOn === "boolean") return data.remindersOn;
  return !!data.push;
}

/** This device's live subscription — created if the browser dropped it. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => window.setTimeout(() => r(null), 8000)),
  ]);
  if (!reg) return null;
  return (
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  );
}

/** Save this device's subscription alongside the others (one per device, newest 5). */
export async function saveThisDevice(userId: string | undefined, turnOn: boolean) {
  const sub = await currentSubscription();
  if (!sub) throw new Error("Service worker not ready");
  const json = sub.toJSON() as SubJSON;
  await patchSettingsData(userId, (d) => {
    const list = ((d.pushSubs as SubJSON[]) ?? []).filter((s) => s.endpoint !== json.endpoint);
    return {
      ...d,
      ...(turnOn ? { remindersOn: true } : {}),
      pushSubs: [json, ...list].slice(0, 5),
    };
  });
}

export async function turnRemindersOff(userId: string | undefined) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* best effort */
  }
  await patchSettingsData(userId, (d) => ({ ...d, remindersOn: false, pushSubs: [], push: null }));
}

/**
 * Self-heal on every app open: browsers quietly rotate or drop push
 * subscriptions, which left her switch "on" while nothing arrived.
 * If reminders are on and notifications are allowed, re-save this
 * device's live subscription.
 */
export function usePushSelfHeal() {
  const { session } = useAuth();
  const settingsQ = useSettings();
  const qc = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !session || !settingsQ.isSuccess || !pushSupported()) return;
    const data = (settingsQ.data?.data ?? {}) as Record<string, unknown>;
    if (!remindersOn(data) || Notification.permission !== "granted") return;
    done.current = true;
    const saved = ((data.pushSubs as SubJSON[]) ?? []).map((s) => s.endpoint);
    void (async () => {
      try {
        const sub = await currentSubscription();
        if (!sub || saved.includes(sub.endpoint)) return;
        await saveThisDevice(session.user.id, false);
        void qc.invalidateQueries({ queryKey: ["ds_settings", session.user.id] });
      } catch {
        /* next open will try again */
      }
    })();
  }, [session, settingsQ.isSuccess, settingsQ.data, qc]);
}
