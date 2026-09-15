"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function initiateConsultation(consultantId: string, serviceType: string, rate: number) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      redirect("/login");
    }

    // 1. Check Wallet Balance Safely
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return { success: false, error: "Failed to verify wallet balance. Please try again later.", code: "DB_ERROR" };
    }

    const balance = profile?.wallet_balance || 0;
    const minRequired = rate * 5; 

    if (balance < minRequired) {
      return { success: false, error: "Insufficient wallet balance. Please recharge to connect with this Master.", code: "LOW_BALANCE" };
    }

    // 2. Create Pending Consultation Record
    const { data: consultation, error: insertError } = await supabase.from("consultations").insert({
      client_id: user.id,
      consultant_id: consultantId,
      service_type: serviceType,
      rate_per_minute: rate,
      status: "PENDING"
    }).select().single();

    if (insertError || !consultation) {
      console.error("Consultation insert error:", insertError);
      return { success: false, error: "System failure. Could not securely connect to the master node.", code: "INSERT_ERROR" };
    }

    // 3. Trigger Real-Time Notification to Consultant (Non-blocking)
    supabase.from("notifications").insert({
      target_user_id: consultantId,
      title: "Incoming Request",
      message: `A seeker has initiated a ${serviceType} consultation.`
    }).then(({ error }) => {
      if (error) console.error("Failed to send real-time notification:", error);
    });

    return { success: true, consultationId: consultation.id };

  } catch (err: any) {
    console.error("Critical Server Action Error in initiateConsultation:", err);
    return { success: false, error: "An unexpected server error occurred. Please contact support.", code: "INTERNAL_ERROR" };
  }
}
