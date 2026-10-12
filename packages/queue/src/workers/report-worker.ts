// ═══════════════════════════════════════════════════════════════════════════════
// Report worker — generates reports via the job queue
// ═══════════════════════════════════════════════════════════════════════════════
// Stub implementation. Replace the generateReport function body with real
// report generation logic (PDF, CSV, analytics aggregation, etc.) when ready.
// ═══════════════════════════════════════════════════════════════════════════════

import { JobQueueClient, type Job } from "../client";

export interface ReportJobPayload {
  type: "revenue" | "users" | "consultations" | "export" | "custom";
  format: "pdf" | "csv" | "json";
  requestedBy: string;
  dateRange?: {
    from: string;
    to: string;
  };
  filters?: Record<string, unknown>;
  /** Where to store the generated report (R2 path, etc.) */
  outputKey?: string;
  /** Email to notify when report is ready */
  notifyEmail?: string;
}

async function generateReport(payload: ReportJobPayload): Promise<string> {
  // ─── STUB: Replace with real report generation ───────────────────────────
  // Steps:
  //   1. Query data based on type + dateRange + filters
  //   2. Format into requested format (PDF/CSV/JSON)
  //   3. Upload to storage (R2/S3)
  //   4. Return the storage key / URL
  console.log(
    `[report-worker] Generating ${payload.format} report: ${payload.type} for user ${payload.requestedBy}`,
  );
  await new Promise((r) => setTimeout(r, 500));
  return `reports/${payload.type}-${Date.now()}.${payload.format}`;
}

export function createReportWorker(queue?: JobQueueClient) {
  const client = queue ?? new JobQueueClient();

  return client.process<ReportJobPayload>(
    "generate-report",
    async (job: Job<ReportJobPayload>) => {
      const outputKey = await generateReport(job.payload);
      // Optionally enqueue a notification to tell the user the report is ready
      if (job.payload.notifyEmail) {
        await client.enqueue("send-notification", {
          userId: job.payload.requestedBy,
          title: "Report ready",
          body: `Your ${job.payload.type} report is ready to download.`,
          actionUrl: `/reports/${outputKey}`,
        } as Record<string, unknown>);
      }
    },
  );
}

export { generateReport };
