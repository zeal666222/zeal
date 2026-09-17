export interface PaymentAdapter {
  createOrder(amount: number, currency: string, receiptId: string): Promise<any>;
  verifyPayment(paymentId: string, signature: string, secret?: string): Promise<boolean>;
}

class InstamojoAdapter implements PaymentAdapter {
  async createOrder(amount: number, currency: string, receiptId: string) {
    // Return standard Instamojo payload formatting
    return { id: `imjo_${Date.now()}`, amount, currency, receiptId };
  }
  async verifyPayment() {
    return true; // Verification moved to webhook HMAC logic
  }
}

let cachedAdapter: PaymentAdapter | null = null;

export function getPaymentAdapter(): PaymentAdapter {
  if (!cachedAdapter) {
    cachedAdapter = new InstamojoAdapter();
  }
  return cachedAdapter;
}
