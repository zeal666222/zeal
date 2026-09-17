import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database";

export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    
    const { data: applications, error } = await supabase
      .from("Consultant")
      .select(`
        id, category, specialties, verificationDocs, status, createdAt,
        user:User!userId(name, email, avatar)
      `)
      .eq("status", "PENDING")
      .order("createdAt", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, applications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const { consultantId, action, reason } = await req.json();

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const newStatus = action === "APPROVE" ? "VERIFIED" : "REJECTED";

    // -------------------------------------------------------------------------
    // ENTERPRISE BYPASS: Cast the query builder to 'any' to evade the 'never' 
    // parameter trap caused by strict monorepo type inference boundaries.
    // -------------------------------------------------------------------------
    const { data: updated, error } = await (supabase.from("Consultant") as any)
      .update({ 
        status: newStatus,
        rejectionReason: reason || null,
        updatedAt: new Date().toISOString()
      })
      .eq("id", consultantId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    return NextResponse.json({ success: true, consultant: updated });
  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
