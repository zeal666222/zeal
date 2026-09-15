import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export default async function proxy(request: NextRequest) {
  // Fallback checks to prevent runtime crash if env loader misses edge runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zyrunsnweznyrhuroduo.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTc2MDgsImV4cCI6MjEwMzA3MzYwOH0.kOPtlaJvT0fnGYit6dG43rekXDin3HoinUNrFB8vtL0";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("CRITICAL: Supabase URL or Anon Key is missing in proxy runtime.");
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
