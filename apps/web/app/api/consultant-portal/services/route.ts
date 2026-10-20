// ZEAL_FIX_SERVICES_API_V2
// ═══════════════════════════════════════════════════════════════════════════════
// Accepts auth from either bearer (admin proxy) or cookie session.
// Accepts {services: [{slug}]} OR {services: [{serviceId, proficiency}]}.
// Refreshes the MV on write so the change propagates immediately.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Schemas ────────────────────────────────────────────────────────────────
const ServiceSlug = z.object({
  slug: z.string().min(1).max(80),
  proficiency: z.number().int().min(1).max(5).default(3),
});

const ServiceId = z.object({
  serviceId: z.string().uuid(),
  proficiency: z.number().int().min(1).max(5).default(3),
});

const PutSchema = z.object({
  services: z.array(z.union([ServiceSlug, ServiceId])).max(50),
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET — list current consultant's tagged services
// ═══════════════════════════════════════════════════════════════════════════════
export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId } = guard;

  const admin = createAdminClient();

  const { data: consultant } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ services: [] });
  }

  const { data } = await admin
    .from("ConsultantService")
    .select("service_id, proficiency, Service(name, slug, parent_category)")
    .eq("consultant_id", consultant.id);

  return NextResponse.json({ services: data ?? [] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT — replace the full set of services
// ═══════════════════════════════════════════════════════════════════════════════
export const PUT = withErrorHandler(async (req: Request) => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId } = guard;

  let raw: unknown;
  try { raw = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = PutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || "Invalid input",
      422,
      ErrorCode.VALIDATION_INPUT,
    );
  }

  const admin = createAdminClient();

  const { data: consultant } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  if (!consultant) {
    throw new AppError("No consultant profile", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  // Normalize every entry to a service_id (resolve slugs)
  const requestedSlugs = parsed.data.services
    .map((s) => ("slug" in s ? s.slug : null))
    .filter((x): x is string => Boolean(x));

  const requestedIds = parsed.data.services
    .map((s) => ("serviceId" in s ? s.serviceId : null))
    .filter((x): x is string => Boolean(x));

  // Resolve slugs → ids
  let idSet = new Set<string>(requestedIds);
  if (requestedSlugs.length > 0) {
    const { data: rows } = await admin
      .from("Service")
      .select("id, slug")
      .in("slug", requestedSlugs);
    for (const r of (rows ?? []) as Array<{ id: string; slug: string }>) {
      idSet.add(r.id);
    }
  }

  // Reconcile by diff instead of wipe+insert. The previous delete-then-insert
  // sequence had a window where a failed insert left the consultant with zero
  // services (their whole catalog destroyed by a bad write). Adding first and
  // only pruning afterwards means a failure can never under-report their tags.
  const { data: existingRows, error: existingErr } = await admin
    .from("ConsultantService")
    .select("service_id")
    .eq("consultant_id", consultant.id);

  if (existingErr) {
    throw new AppError(existingErr.message, 500, ErrorCode.INTERNAL_SERVER);
  }

  const existing = new Set<string>(
    ((existingRows ?? []) as Array<{ service_id: string }>).map((r) => r.service_id),
  );
  const toAdd = Array.from(idSet).filter((id) => !existing.has(id));
  const toRemove = Array.from(existing).filter((id) => !idSet.has(id));

  if (toAdd.length > 0) {
    const { error: insertErr } = await admin.from("ConsultantService").insert(
      toAdd.map((id) => ({
        consultant_id: consultant.id,
        service_id: id,
        proficiency: 3,
      })),
    );
    if (insertErr) {
      throw new AppError(insertErr.message, 500, ErrorCode.INTERNAL_SERVER);
    }
  }

  if (toRemove.length > 0) {
    const { error: deleteErr } = await admin
      .from("ConsultantService")
      .delete()
      .eq("consultant_id", consultant.id)
      .in("service_id", toRemove);
    if (deleteErr) {
      console.warn("[services] prune failed (extra tags retained):", deleteErr.message);
    }
  }

  // Immediate MV refresh so the change lands on the next read
  try {
    await admin.rpc("refresh_consultant_directory");
  } catch (e) {
    console.warn("[services] MV refresh failed (best-effort):", e);
  }

  return NextResponse.json({ success: true, count: idSet.size });
});
