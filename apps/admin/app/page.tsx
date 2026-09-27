import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSignOutAction } from "@/actions/auth";
import { Activity, ArrowRight, Briefcase, Calendar, DollarSign, LogOut, ShieldCheck, Star,
  Users } from "lucide-react";
import Link from "next/link";

export default async function AdminLandingPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("User")
    .select("name, role, wallet_balance")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) || "USER";
  const isConsultant = role === "CLIENT_ADMIN";
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "SUPPORT", "VIEWER"].includes(role);

  // Redirect to the correct console immediately — no flash of landing page
  if (isConsultant) redirect("/consultant/dashboard");
  if (isAdmin) redirect("/dashboard");

  // Unknown role: show a branded "not authorized" screen
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-rose-500/8 blur-[160px] pointer-events-none" />

      <div className="relative max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck size={28} className="text-rose-600 dark:text-rose-400" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">
          Account not yet authorized
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          This account isn't linked to a consultant studio or admin console.
          If you're a seeker, head back to the main app.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <a
            href={process.env.NEXT_PUBLIC_APP_URL || "https://zeal-web-red.vercel.app"}
            className="p-4 rounded-2xl bg-surface border border-border hover:border-purple-500/40 transition-all text-left"
          >
            <Sparkles size={16} className="text-purple-600 dark:text-purple-400 mb-3" />
            <p className="text-foreground font-bold text-sm">Go to Zeal</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Seeker portal</p>
          </a>

          <form action={adminSignOutAction}>
            <button
              type="submit"
              className="w-full h-full p-4 rounded-2xl bg-surface border border-border hover:border-rose-500/40 transition-all text-left"
            >
              <LogOut size={16} className="text-rose-600 dark:text-rose-400 mb-3" />
              <p className="text-foreground font-bold text-sm">Sign out</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Try a different account</p>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Sparkles({ size, className }: { size: number; className?: string }) {
  return <Activity size={size} className={className} />;
}
