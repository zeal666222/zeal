// ═══════════════════════════════════════════════════════════════════════════════
// Notification worker — sends push notifications via the job queue
// ═══════════════════════════════════════════════════════════════════════════════
// Stub implementation. Replace with a real push provider (Firebase Cloud
// Messaging, OneSignal, etc.) when ready.
// ═══════════════════════════════════════════════════════════════════════════════

import { JobQueueClient, type Job } from "../client";

export interface NotificationJobPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Push subscription endpoint (web push) */
  endpoint?: string;
  /** FCM device token (mobile push) */
  deviceToken?: string;
  /** Notification category for grouping */
  category?: string;
  /** Deep link to open when tapped */
  actionUrl?: string;
}

async function sendNotification(payload: NotificationJobPayload): Promise<void> {
  // ─── STUB: Replace with real push provider ───────────────────────────────
  // Example with Firebase Admin:
  //   await admin.messaging().send({ token: payload.deviceToken, notification: {...} });
  console.log(
    `[notification-worker] Push to user ${payload.userId}: ${payload.title}`,
  );
  await new Promise((r) => setTimeout(r, 50));
}

export function createNotificationWorker(queue?: JobQueueClient) {
  const client = queue ?? new JobQueueClient();

  return client.process<NotificationJobPayload>(
    "send-notification",
    async (job: Job<NotificationJobPayload>) => {
      await sendNotification(job.payload);
    },
  );
}

export { sendNotification };
