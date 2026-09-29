// packages/realtime/src/channels.ts
// ⚠ No "use client" — channels are just strings. Removing the directive
//    lets server code import channel names without triggering client taint.
export const channels = {
  userInbox:         (uid: string) => `user:${uid}:inbox`,
  userWallet:        (uid: string) => `user:${uid}:wallet`,
  userWalletLedger:  (uid: string) => `user:${uid}:wallet:ledger`,
  userNotifications: (uid: string) => `user:${uid}:notifications`,
  userStatus:        (uid: string) => `user:${uid}:status`,
  userSparks:        (uid: string) => `user:${uid}:sparks`,
  roomMessages:      (conversationId: string) => `room:${conversationId}:messages`,
  roomTyping:        (conversationId: string) => `room:${conversationId}:typing`,
  consultantIncoming:  (uid: string) => `consultant:${uid}:incoming`,
  consultantSparks:    (uid: string) => `consultant:${uid}:sparks`,
  consultantBookings:  (uid: string) => `consultant:${uid}:bookings`,
  consultantStatus:    (uid: string) => `consultant:${uid}:status`,
  consultantAiUpdates: () => `consultant:ai:updates`,
  consultantsLive:     () => `consultants:live`,
  bookingStatus:     (bookingId: string) => `booking:${bookingId}:status`,
  adminBookings:     () => `admin:bookings`,
  adminVerification: () => `admin:verification`,
  adminBroadcasts:   () => `admin:broadcasts`,
} as const;
export type ChannelName = ReturnType<typeof channels[keyof typeof channels]>;
