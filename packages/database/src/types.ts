import type { Database, Json } from "@zeal/types";
export type { Database, Json };

export type Role = "USER" | "CLIENT_ADMIN" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN" | "VIEWER" | "AI";
export type ConsultantStatus = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
export type ConsultantCategory =
  | "ASTROLOGER" | "PSYCHOLOGIST" | "TAROT" | "NUMEROLOGIST"
  | "PALMIST" | "VASTU" | "REIKI" | "LIFE_COACH"
  | "MOTIVATIONAL_SPEAKER" | "SPIRITUAL_GUIDE"
  | "YOGA_INSTRUCTOR" | "HEALER";
export type Faith = "HINDU" | "ISLAM" | "CHRISTIAN" | "BUDDHIST" | "JEWISH" | "SIKH" | "OTHER";
export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "MISSED" | "DISPUTED";
export type CallStatus = "INITIATED" | "CONNECTED" | "ENDED" | "RECORDING_READY";
export type TransactionType = "TOPUP" | "PAYMENT" | "REFUND" | "PAYOUT" | "FEE" | "COMMISSION";
