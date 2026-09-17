// Notification service – unified email + in-app notifications
import { prisma } from "@zeal/database";
import { sendEmail } from "@/lib/emails";
import { emailTemplates } from "@/lib/emails/templates";
import { serverPublish } from "@/lib/realtime/server";

export type NotificationType =
  | "booking"
  | "call"
  | "chat"
  | "system"
  | "referral"
  | "quest"
  | "payment"
  | "verification"
  | "new_post"
  | "reminder";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  message: string;
  redirectUrl?: string;
  actorId: string;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
  emailTemplate?: keyof typeof emailTemplates;
  emailContext?: Record<string, unknown>;
}

export interface NotificationListOptions {
  limit?: number;
  offset?: number;
}

export class NotificationService {
  static async createNotification(params: CreateNotificationParams) {
    const notif = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        message: params.message,
        redirectUrl: params.redirectUrl ?? null,
        actorId: params.actorId,
        read: false,
      },
    });

    // ─── Realtime push (best-effort) ─────────────────────────────────
    try {
      await serverPublish(`user:${params.userId}`, "notification", {
        id: notif.id,
        type: notif.type,
        message: notif.message,
        redirectUrl: notif.redirectUrl,
        createdAt: notif.createdAt.toISOString(),
      });
    } catch (err) {
      console.warn("[Notifications] Realtime publish failed:", err);
    }

    // ─── Email (opt-in) ──────────────────────────────────────────────
    if (params.sendEmail && params.emailTemplate) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: params.userId },
          select: { email: true },
        });
        if (user?.email) {
          const tplFn = emailTemplates[params.emailTemplate] as
            | ((...args: unknown[]) => { subject: string; html: string })
            | undefined;
          if (typeof tplFn === "function") {
            const args = Object.values(params.emailContext ?? {});
            const tpl = tplFn(...args);
            await sendEmail({
              to: user.email,
              subject: tpl.subject,
              html: tpl.html,
            });
          }
        }
      } catch (err) {
        console.warn("[Notifications] Email send failed:", err);
      }
    }

    return notif;
  }

  static async markAsRead(notificationId: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  static async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  static async getNotifications(
    userId: string,
    options?: NotificationListOptions,
  ) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { items, total, unreadCount };
  }

  static async broadcast(params: {
    message: string;
    type?: NotificationType;
    actorId: string;
    targetUserIds?: string[];
    segment?: "all" | "consultants" | "users";
  }): Promise<{ sent: number }> {
    let userIds: string[] = params.targetUserIds ?? [];

    if (!params.targetUserIds && params.segment) {
      if (params.segment === "all") {
        const users = await prisma.user.findMany({
          select: { id: true },
          take: 5000,
        });
        userIds = users.map((u: any) => u.id);
      } else if (params.segment === "consultants") {
        const consultants = await prisma.consultant.findMany({
          where: { status: "VERIFIED" },
          select: { userId: true },
          take: 5000,
        });
        userIds = consultants.map((c: any) => c.userId);
      } else {
        const users = await prisma.user.findMany({
          where: { role: "USER" },
          select: { id: true },
          take: 5000,
        });
        userIds = users.map((u: any) => u.id);
      }
    }

    let sent = 0;
    for (const userId of userIds) {
      try {
        await this.createNotification({
          userId,
          type: params.type ?? "system",
          message: params.message,
          actorId: params.actorId,
        });
        sent++;
      } catch (err) {
        console.warn("[Notifications] Broadcast failed for", userId, err);
      }
    }
    return { sent };
  }
}

// SUPABASE_REALTIME_FIX_APPLIED
