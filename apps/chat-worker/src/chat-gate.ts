// ChatGate — Durable Object for shared concurrency control across all worker isolates.
// Single actor model ensures per-user and global limits are enforced account-wide,
// not per-isolate. Leases auto-expire after TTL to prevent leaks from dead isolates.

export class ChatGate {
  state: DurableObjectState;
  leases: Map<string, { userId: string; createdAt: number; ttlMs: number }>;
  globalCount: number;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.leases = new Map();
    this.globalCount = 0;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<{ leases: Array<[string, { userId: string; createdAt: number; ttlMs: number }]>; globalCount: number }>("gate");
      if (stored) {
        this.leases = new Map(stored.leases);
        this.globalCount = stored.globalCount;
      }
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acquire" && req.method === "POST") {
      const { userId, maxPerUser, maxGlobal, ttlMs } = await req.json() as { userId: string; maxPerUser: number; maxGlobal: number; ttlMs: number };
      return this.acquire(userId, maxPerUser, maxGlobal, ttlMs);
    }
    if (url.pathname === "/release" && req.method === "POST") {
      const { leaseId } = await req.json() as { leaseId: string };
      return this.release(leaseId);
    }
    if (url.pathname === "/stats" && req.method === "GET") {
      return this.stats();
    }
    return new Response("not found", { status: 404 });
  }

  private acquire(userId: string, maxPerUser: number, maxGlobal: number, ttlMs: number): Response {
    const now = Date.now();
    // Prune expired leases
    for (const [id, lease] of this.leases) {
      if (now - lease.createdAt > lease.ttlMs) {
        this.leases.delete(id);
        this.globalCount = Math.max(0, this.globalCount - 1);
      }
    }
    // Per-user count
    let userCount = 0;
    for (const lease of this.leases.values()) {
      if (lease.userId === userId) userCount++;
    }
    if (userCount >= maxPerUser) {
      return Response.json({ allowed: false, error: `Too many concurrent chats (max ${maxPerUser}).` }, { status: 429 });
    }
    if (this.globalCount >= maxGlobal) {
      return Response.json({ allowed: false, error: "Platform at capacity." }, { status: 429 });
    }
    const leaseId = crypto.randomUUID();
    this.leases.set(leaseId, { userId, createdAt: now, ttlMs });
    this.globalCount++;
    this.persist();
    return Response.json({ allowed: true, leaseId, currentPerUser: userCount + 1, currentGlobal: this.globalCount });
  }

  private release(leaseId: string): Response {
    const lease = this.leases.get(leaseId);
    if (lease) {
      this.leases.delete(leaseId);
      this.globalCount = Math.max(0, this.globalCount - 1);
      this.persist();
      return Response.json({ released: true });
    }
    return Response.json({ released: false, error: "lease not found" }, { status: 404 });
  }

  private stats(): Response {
    const now = Date.now();
    let active = 0;
    const perUser: Record<string, number> = {};
    for (const lease of this.leases.values()) {
      if (now - lease.createdAt <= lease.ttlMs) {
        active++;
        perUser[lease.userId] = (perUser[lease.userId] || 0) + 1;
      }
    }
    return Response.json({ active, perUser, globalMax: 2000, perUserMax: 50 });
  }

  private async persist() {
    await this.state.storage.put("gate", { leases: Array.from(this.leases.entries()), globalCount: this.globalCount });
  }
}
