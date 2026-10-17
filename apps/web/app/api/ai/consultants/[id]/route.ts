import { NextResponse } from "next/server";
import {createAdminClient} from "@zeal/database/server";

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
    const { data, error } = await admin
      .from("AIConsultant")
      .select("*")
      .eq(isUuid ? "id" : "username", id)
      .eq("isActive", true)
      .maybeSingle();

    if (error || !data) {
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
