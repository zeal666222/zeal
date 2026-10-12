// ═══════════════════════════════════════════════════════════════════════════════
// Job Queue — Unit tests
// ═══════════════════════════════════════════════════════════════════════════════
// These tests verify the JobQueueClient API contract. They mock the Supabase
// admin client so they can run without a live database.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobQueueClient, JobQueueError } from "../client";

// ─── Mock @zeal/database/server ──────────────────────────────────────────────
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn((table: string) => ({
  insert: mockInsert.mockReturnValue({
    select: mockSelect.mockReturnValue({
      single: mockSingle.mockResolvedValue({
        data: { id: "test-job-id" },
        error: null,
      }),
    }),
  }),
  select: mockSelect.mockReturnValue({
    eq: mockEq.mockResolvedValue({ count: 5, error: null }),
    single: mockSingle.mockResolvedValue({ data: null, error: null }),
  }),
}));

vi.mock("@zeal/database/server", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("JobQueueClient", () => {
  let queue: JobQueueClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new JobQueueClient();
  });

  describe("enqueue", () => {
    it("inserts a job with default options", async () => {
      const id = await queue.enqueue("send-email", {
        to: "user@example.com",
        subject: "Hello",
      });

      expect(id).toBe("test-job-id");
      expect(mockFrom).toHaveBeenCalledWith("JobQueue");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "send-email",
          payload: { to: "user@example.com", subject: "Hello" },
          priority: 0,
          maxAttempts: 3,
          status: "pending",
        }),
      );
    });

    it("respects custom priority and maxAttempts", async () => {
      await queue.enqueue(
        "send-email",
        { to: "user@example.com" },
        { priority: 10, maxAttempts: 5 },
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 10,
          maxAttempts: 5,
        }),
      );
    });

    it("respects scheduledAt", async () => {
      const futureDate = new Date("2025-01-01T00:00:00Z");
      await queue.enqueue(
        "send-email",
        { to: "user@example.com" },
        { scheduledAt: futureDate },
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledAt: futureDate.toISOString(),
        }),
      );
    });

    it("throws JobQueueError on insert failure", async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "DB connection lost" },
      });

      await expect(
        queue.enqueue("send-email", { to: "x" }),
      ).rejects.toThrow(JobQueueError);
    });
  });

  describe("dequeue", () => {
    it("calls dequeue_jobs RPC with correct params", async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: "job-1",
            type: "send-email",
            payload: { to: "a@b.com" },
            status: "processing",
          },
        ],
        error: null,
      });

      const jobs = await queue.dequeue("send-email", 5);

      expect(mockRpc).toHaveBeenCalledWith("dequeue_jobs", {
        p_type: "send-email",
        p_batch_size: 5,
      });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.id).toBe("job-1");
    });

    it("returns empty array when no jobs available", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const jobs = await queue.dequeue("send-email");
      expect(jobs).toEqual([]);
    });

    it("throws JobQueueError on RPC failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC timeout" },
      });

      await expect(queue.dequeue("send-email")).rejects.toThrow(JobQueueError);
    });
  });

  describe("complete", () => {
    it("calls complete_job RPC", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await queue.complete("job-123");

      expect(mockRpc).toHaveBeenCalledWith("complete_job", {
        p_job_id: "job-123",
      });
      expect(result).toBe(true);
    });
  });

  describe("fail", () => {
    it("calls fail_job RPC with error message", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await queue.fail("job-123", "Network timeout");

      expect(mockRpc).toHaveBeenCalledWith("fail_job", {
        p_job_id: "job-123",
        p_error_msg: "Network timeout",
      });
      expect(result).toBe(true);
    });
  });

  describe("stats", () => {
    it("returns queue statistics", async () => {
      // Mock the count queries for each status
      mockEq
        .mockResolvedValueOnce({ count: 10, error: null }) // pending
        .mockResolvedValueOnce({ count: 3, error: null })  // processing
        .mockResolvedValueOnce({ count: 50, error: null }) // completed
        .mockResolvedValueOnce({ count: 2, error: null });  // failed

      const stats = await queue.stats("send-email");

      expect(stats).toEqual({
        total: 10,
        pending: 10,
        processing: 3,
        completed: 50,
        failed: 2,
      });
    });
  });

  describe("cleanupCompleted", () => {
    it("calls cleanup_completed_jobs RPC", async () => {
      mockRpc.mockResolvedValueOnce({ data: 42, error: null });

      const deleted = await queue.cleanupCompleted(14);

      expect(mockRpc).toHaveBeenCalledWith("cleanup_completed_jobs", {
        p_older_than_days: 14,
      });
      expect(deleted).toBe(42);
    });
  });
});
