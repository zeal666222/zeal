import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const admin = createAdminClient();
    const isUuid = UUID_RE.test(id);

    let data = null;

    if (isUuid) {
      const res = await admin.from("AIConsultant").select("*").eq("id", id).maybeSingle();
      data = res.data;
    } else {
      // Try exact username match first
      const exact = await admin.from("AIConsultant").select("*").eq("username", id).maybeSingle();
      data = exact.data;

      // Fallback: case-insensitive ILIKE match
      if (!data) {
        const fuzzy = await admin
          .from("AIConsultant")
          .select("*")
          .ilike("username", id)
          .maybeSingle();
        data = fuzzy.data;
      }

      // Fallback: match by slugified name (replace spaces/special chars with hyphens)
      if (!data) {
        const slug = id.replace(/-/g, "_").toLowerCase();
        const bySlug = await admin
          .from("AIConsultant")
          .select("*")
          .ilike("username", `%${slug}%`)
          .limit(1)
          .maybeSingle();
        data = bySlug.data;
      }
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.warn("[AI Detail API] failed:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
