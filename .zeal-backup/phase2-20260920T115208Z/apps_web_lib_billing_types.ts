// ═══════════════════════════════════════════════════════════════════════════════
// Billing types — shared between server + client
// ═══════════════════════════════════════════════════════════════════════════════

export interface BillingSession {
  id: string;
  userId: string;
  consultantId: string | null;
  aiConsultantId: string | null;
  isAI: boolean;
  startTime: string;
  lastBilledAt: string;
  endTime: string | null;
  durationSeconds: number;
  amount: number;
  status: "INITIATED" | "CONNECTED" | "ENDED" | "RECORDING_READY";
}

export interface SessionStartResult {
  success: boolean;
  sessionId?: string;
  rate?: number;
  initialMinutes?: number;
  initialCharge?: number;
  error?: string;
  code?: "LOW_BALANCE" | "NOT_CONSULTANT" | "CONFLICT" | "INTERNAL";
}

export interface HeartbeatResult {
  success: boolean;
  sessionId?: string;
  elapsedSeconds?: number;
  minutesBilled?: number;
  cost?: number;
  remaining?: number;
  terminate?: boolean;
  reason?: string;
  error?: string;
}

export interface SessionEndResult {
  success: boolean;
  sessionId?: string;
  durationSeconds?: number;
  totalCost?: number;
  consultantEarning?: number;
  platformFee?: number;
  refunded?: number;
  error?: string;
}

export const MIN_START_MINUTES = 5;
export const LOW_BALANCE_THRESHOLD_MINUTES = 2;
export const HEARTBEAT_INTERVAL_SECONDS = 30;
