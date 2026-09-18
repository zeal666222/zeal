"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — Typed Channel Builders
// Single source of truth for every realtime topic in the platform.
// ═══════════════════════════════════════════════════════════════════════════════

export const channels = {
  // ─── User-scoped ────────────────────────────────────────────────────────────
  userInbox:         (uid: string) => `user:${uid}:inbox`,
  userWallet:        (uid: string) => `user:${uid}:wallet`,
  userNotifications: (uid: string) => `user:${uid}:notifications`,
  userStatus:        (uid: string) => `user:${uid}:status`,
  userSparks:        (uid: string) => `user:${uid}:sparks`,

  // ─── Conversation / chat ────────────────────────────────────────────────────
  roomMessages:      (conversationId: string) => `room:${conversationId}:messages`,
  roomTyping:        (conversationId: string) => `room:${conversationId}:typing`,

  // ─── Consultant (per-consultant) ────────────────────────────────────────────
  consultantIncoming:  (uid: string) => `consultant:${uid}:incoming`,
  consultantSparks:    (uid: string) => `consultant:${uid}:sparks`,
  consultantStatus:    (uid: string) => `consultant:${uid}:status`,
  consultantAiUpdates: () => `consultant:ai:updates`,       // public
  consultantsLive:     () => `consultants:live`,             // public directory

  // ─── Booking ────────────────────────────────────────────────────────────────
  bookingStatus:     (bookingId: string) => `booking:${bookingId}:status`,

  // ─── Admin ──────────────────────────────────────────────────────────────────
  adminBookings:     () => `admin:bookings`,
  adminVerification: () => `admin:verification`,
  adminBroadcasts:   () => `admin:broadcasts`,
} as const;

export type ChannelName = ReturnType<typeof channels[keyof typeof channels]>;
