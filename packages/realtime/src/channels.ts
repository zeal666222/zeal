// packages/realtime/src/channels.ts
// ⚠ No "use client" — channels are just strings. Removing the directive
//    lets server code import channel names without triggering client taint.
export const channels = {
  userInbox:         (uid: string) => `user:${uid}:inbox`,
  userWallet:        (uid: string) => `user:${uid}:wallet`,
  userWalletLedger:  (uid: string) => `user:${uid}:wallet:ledger`,
  userNotifications: (uid: string) => `user:${uid}:notifications`,
  userStatus:        (uid: string) => `user:${uid}:status`,
  // Topic MUST match RLS on realtime.messages: 'user:' || auth.uid() || ':%'.
  // The previous shape `user:profile:<uid>` had the uid at the tail and was
  // silently rejected by the policy, killing avatar realtime.
  userProfile:       (uid: string) => `user:${uid}:profile`,
  userSparks:        (uid: string) => `user:${uid}:sparks`,
  userPayments:      (uid: string) => `user:${uid}:payments`,
  roomMessages:      (conversationId: string) => `room:${conversationId}:messages`,
  roomTyping:        (conversationId: string) => `room:${conversationId}:typing`,
  feedPosts:         () => `feed:posts`,
  sessionBilling:    (sessionId: string) => `session:${sessionId}:billing`,
  consultantIncoming:  (uid: string) => `consultant:${uid}:incoming`,
  consultantSparks:    (uid: string) => `consultant:${uid}:sparks`,
  consultantBookings:  (uid: string) => `consultant:${uid}:bookings`,
  consultantStatus:    (uid: string) => `consultant:${uid}:status`,
  consultantAiUpdates: () => `consultant:ai:updates`,
  consultantsLive:     () => `consultants:live`,
  bookingStatus:     (bookingId: string) => `booking:${bookingId}:status`,
  bookingSlots:      (consultantId: string) => `booking:${consultantId}:slots`,
  adminBookings:     () => `admin:bookings`,
  adminVerification: () => `admin:verification`,
  adminPricing:      () => `admin:pricing`,
  adminBroadcasts:   () => `admin:broadcasts`,
  adminPayments:     () => `admin:payments`,
  adminSettings:     () => `admin:settings`,
  adminReconciliation: () => `admin:reconciliation`,
  adminRealtime:     () => `admin:realtime:monitor`,
  aiSessionMetrics:  (sessionId: string) => `ai:session:${sessionId}:metrics`,
  aiResponseStream:  (sessionId: string) => `ai:session:${sessionId}:response`,
  systemHealth:      () => `system:health`,
  systemAlerts:      () => `system:alerts`,
} as const;
export type ChannelName = ReturnType<typeof channels[keyof typeof channels]>;
