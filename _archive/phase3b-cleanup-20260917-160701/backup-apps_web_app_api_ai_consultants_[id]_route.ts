import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Attempt 1: Prisma
  try {
    const consultant = await prisma.aIConsultant.findUnique({ where: { id } });
    if (consultant) {
      return NextResponse.json(consultant, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
  } catch (err) {
    console.warn("[AI Detail API] Prisma failed:", err);
  }

  // Attempt 2: Supabase Service Role
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data, error } = await admin
        .from("AIConsultant")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        return NextResponse.json(data, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      }
    }
  } catch (err) {
    console.warn("[AI Detail API] Supabase fallback failed:", err);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
