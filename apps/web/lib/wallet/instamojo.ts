// apps/web/lib/wallet/instamojo.ts
// REPURPOSED as the Razorpay client. Filename preserved for import stability.
import "server-only";
import Razorpay from "razorpay";
import crypto from "crypto";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

let _client: Razorpay | null = null;
function getClient(): Razorpay {
  if (_client) return _client;
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error("[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing");
  }
  _client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  return _client;
}

export interface CreateOrderParams {
  amount: number;               // rupees
  receipt: string;
  notes: Record<string, string>;
}

export interface CreateOrderResult {
  id: string;
  amount: number;               // paise (as returned by Razorpay)
  currency: string;
}

export async function createRazorpayOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const client = getClient();
  const order = await client.orders.create({
    amount: Math.round(params.amount * 100),
    currency: "INR",
    receipt: params.receipt,
    notes: params.notes,
  });
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const body = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", KEY_SECRET).update(body).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(params.signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface RazorpayPaymentEntity {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
  const client = getClient();
  const payment = await client.payments.fetch(paymentId);
  return payment as unknown as RazorpayPaymentEntity;
}

export function getPublicKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? KEY_ID;
}

// Legacy shim so stale imports compile
export const instamojo = {
  async createPaymentRequest(): Promise<never> {
    throw new Error("Instamojo is deprecated. Use Razorpay.");
  },
  async getPaymentRequest(): Promise<never> {
    throw new Error("Instamojo is deprecated. Use Razorpay.");
  },
  verifyWebhook(): boolean {
    return false;
  },
};
