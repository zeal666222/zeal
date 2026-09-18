"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — Typed Channel Builders
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for every realtime topic in the platform.
// ═══════════════════════════════════════════════════════════════════════════════

export const channels = {
  // ─── User-scoped ────────────────────────────────────────────────────────────
  userInbox:         (uid: string) => `user:${uid}:inbox`,
  userWallet:        (uid: string) => `user:${uid}:wallet`,
  userWalletLedger:  (uid: string) => `user:${uid}:wallet:ledger`,
  userNotifications: (uid: string) => `user:${uid}:notifications`,
  userStatus:        (uid: string) => `user:${uid}:status`,
  userSparks:        (uid: string) => `user:${uid}:sparks`,

  // ─── Conversation / chat ────────────────────────────────────────────────────
  roomMessages:      (conversationId: string) => `room:${conversationId}:messages`,
  roomTyping:        (conversationId: string) => `room:${conversationId}:typing`,

  // ─── Consultant ─────────────────────────────────────────────────────────────
  consultantIncoming:  (uid: string) => `consultant:${uid}:incoming`,
  consultantSparks:    (uid: string) => `consultant:${uid}:sparks`,
  consultantBookings:  (uid: string) => `consultant:${uid}:bookings`,
  consultantStatus:    (uid: string) => `consultant:${uid}:status`,
  consultantAiUpdates: () => `consultant:ai:updates`,
  consultantsLive:     () => `consultants:live`,

  // ─── Booking ────────────────────────────────────────────────────────────────
  bookingStatus:     (bookingId: string) => `booking:${bookingId}:status`,

  // ─── Admin ──────────────────────────────────────────────────────────────────
  adminBookings:     () => `admin:bookings`,
  adminVerification: () => `admin:verification`,
  adminBroadcasts:   () => `admin:broadcasts`,
} as const;

export type ChannelName = ReturnType<typeof channels[keyof typeof channels]>;
