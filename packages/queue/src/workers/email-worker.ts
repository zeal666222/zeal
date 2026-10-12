// ═══════════════════════════════════════════════════════════════════════════════
// Email worker — sends emails via the job queue
// ═══════════════════════════════════════════════════════════════════════════════
// Stub implementation. Replace the sendEmail function body with a real email
// provider (SendGrid, Resend, SES, etc.) when ready.
// ═══════════════════════════════════════════════════════════════════════════════

import { JobQueueClient, type Job } from "../client";

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

async function sendEmail(payload: EmailJobPayload): Promise<void> {
  // ─── STUB: Replace with real email provider ──────────────────────────────
  // Example with Resend:
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({ from: payload.from ?? 'noreply@zeal.app', ... });
  console.log(`[email-worker] Sending email to ${payload.to}: ${payload.subject}`);
  // Simulate async work
  await new Promise((r) => setTimeout(r, 100));
}

export function createEmailWorker(queue?: JobQueueClient) {
  const client = queue ?? new JobQueueClient();

  return client.process<EmailJobPayload>("send-email", async (job: Job<EmailJobPayload>) => {
    await sendEmail(job.payload);
  });
}

export { sendEmail };
