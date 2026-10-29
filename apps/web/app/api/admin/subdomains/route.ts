import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ProvisionSchema = z.object({
  consultantId: z.string().uuid(),
  subdomain: z.string().trim().min(3).max(30).regex(/^[a-z0-9]+$/, "Lowercase letters and numbers only"),
  action: z.enum(["provision", "revoke", "toggle"]),
});

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: u } = await admin.from("User").select("role").eq("id", user.id).maybeSingle();
  if (!u || !["SUPER_ADMIN", "ADMIN"].includes((u.role ?? "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: consultants, error } = await admin
    .from("Consultant")
    .select(`
      id, subdomain, "subdomainActive", "whiteLabelEnabled",
      user:User!userId(id, name, username, email)
    `)
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch consultants" }, { status: 500 });
  }

  const rows = (consultants ?? []).map((c: Record<string, unknown>) => {
    const userRel = Array.isArray(c.user) ? c.user[0] : c.user;
    return {
      id: c.id,
      subdomain: c.subdomain,
      subdomainActive: c.subdomainActive,
      whiteLabelEnabled: c.whiteLabelEnabled,
      userName: userRel?.name ?? userRel?.username ?? null,
      userEmail: userRel?.email ?? null,
      pageUrl: c.subdomain ? `https://${c.subdomain}.zealer.co.in` : null,
    };
  });

  return NextResponse.json({ success: true, consultants: rows });
}

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: u } = await admin.from("User").select("role").eq("id", user.id).maybeSingle();
  if (!u || !["SUPER_ADMIN", "ADMIN"].includes((u.role ?? "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProvisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 422 },
    );
  }

  const { consultantId, subdomain, action } = parsed.data;

  if (action === "provision") {
    const { data: existing } = await admin
      .from("Consultant")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
    }

    const { error } = await admin
      .from("Consultant")
      .update({ subdomain, "subdomainActive": true })
      .eq("id", consultantId);

    if (error) {
      return NextResponse.json({ error: "Failed to provision subdomain" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Subdomain ${subdomain}.zealer.co.in provisioned`,
      url: `https://${subdomain}.zealer.co.in`,
    });
  }

  if (action === "revoke") {
    const { error } = await admin
      .from("Consultant")
      .update({ subdomain: null, "subdomainActive": false })
      .eq("id", consultantId);

    if (error) {
      return NextResponse.json({ error: "Failed to revoke subdomain" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Subdomain revoked" });
  }

  if (action === "toggle") {
    const { data: consultant } = await admin
      .from("Consultant")
      .select("subdomainActive")
      .eq("id", consultantId)
      .maybeSingle();

    if (!consultant) {
      return NextResponse.json({ error: "Consultant not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("Consultant")
      .update({ "subdomainActive": !consultant.subdomainActive })
      .eq("id", consultantId);

    if (error) {
      return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subdomainActive: !consultant.subdomainActive,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
