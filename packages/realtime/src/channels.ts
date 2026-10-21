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
  // A consultant's own pricing requests move under admin review while their
  // page is open; without this topic the decision only shows on refresh.
  userPricing:       (uid: string) => `user:${uid}:pricing`,
  roomMessages:      (conversationId: string) => `room:${conversationId}:messages`,
  roomTyping:        (conversationId: string) => `room:${conversationId}:typing`,
  feedPosts:         () => `feed:posts`,
  sessionBilling:    (sessionId: string) => `session:${sessionId}:billing`,
  consultantIncoming:  (uid: string) => `consultant:${uid}:incoming`,
  consultantSparks:    (uid: string) => `consultant:${uid}:sparks`,
  consultantBookings:  (uid: string) => `consultant:${uid}:bookings`,
  // Owner-only presence: the realtime_user_channels policy authorizes
  // `consultant:<auth.uid()>:%`, so this is the consultant watching their own
  // toggle from another tab. Anonymous visitors use consultantsLive instead.
  consultantStatus:    (uid: string) => `consultant:${uid}:status`,
  consultantAiUpdates: () => `consultant:ai:updates`,
  consultantsLive:     () => `consultants:live`,
  // Aggregated guide counts per category — the write side is the Consultant /
  // ConsultantService count triggers, and it is an invalidation signal only.
  directoryCounts:     () => `directory:counts`,
  bookingStatus:     (bookingId: string) => `booking:${bookingId}:status`,
  // Availability is computed from Booking rows, so there is no slots table and
  // no per-seeker topic: one public channel per consultant, carrying no
  // participant identity. `booking:<consultantId>:slots` was the old shape — it
  // was authorized by user_can_view_booking(consultantId), which never matches
  // a consultant id, so it could not have worked even if it had a publisher.
  slotAvailability:  (consultantId: string) => `slots:${consultantId}`,
  adminBookings:     () => `admin:bookings`,
  adminVerification: () => `admin:verification`,
  adminPricing:      () => `admin:pricing`,
  adminWithdrawals:  () => `admin:withdrawals`,
  adminModeration:   () => `admin:moderation`,
  adminAudit:        () => `admin:audit`,
  adminBroadcasts:   () => `admin:broadcasts`,
  adminPayments:     () => `admin:payments`,
  adminSettings:     () => `admin:settings`,
  adminReconciliation: () => `admin:reconciliation`,
  adminRealtime:     () => `admin:realtime:monitor`,
  aiSessionMetrics:  (sessionId: string) => `ai:session:${sessionId}:metrics`,
  aiResponseStream:  (sessionId: string) => `ai:session:${sessionId}:response`,
  systemHealth:      () => `system:health`,
  systemAlerts:      () => `system:alerts`,
  // Site-wide visitor presence. Clients track themselves (path + profile);
  // admins subscribe to count and list active visitors in realtime. The
  // client joins this as `presence:site:presence`, which the public-prefix
  // allowlist in client.ts already covers.
  sitePresence:      () => `site:presence`,
} as const;
export type ChannelName = ReturnType<typeof channels[keyof typeof channels]>;
