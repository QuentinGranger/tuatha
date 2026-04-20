// ─── Web Push Utility ───
// Server-side utility for sending Web Push notifications via VAPID.

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { secrets } from "@/lib/vault";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!secrets.hasWebPush()) return false;

  webpush.setVapidDetails(
    `mailto:${secrets.resendFromEmail().replace(/.*<|>.*/g, "") || "noreply@tuatha-app.com"}`,
    secrets.vapidPublicKey(),
    secrets.vapidPrivateKey()
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to all devices of a given professional.
 * Automatically removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(proId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { proId },
  });

  if (subscriptions.length === 0) return 0;

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag,
    url: payload.url || "/",
    data: payload.data,
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          jsonPayload,
          { TTL: 60 * 60 } // 1 hour
        );
        sent++;
      } catch (err: any) {
        // 404 or 410 = subscription expired or unsubscribed
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  return sent;
}

/**
 * Send a push notification to multiple professionals.
 */
export async function sendPushToUsers(proIds: string[], payload: PushPayload): Promise<number> {
  let total = 0;
  await Promise.allSettled(
    proIds.map(async (proId) => {
      total += await sendPushToUser(proId, payload);
    })
  );
  return total;
}
