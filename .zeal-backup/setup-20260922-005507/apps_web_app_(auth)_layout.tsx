// apps/web/app/(auth)/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Auth route group — centered card layout, no chrome
// ═══════════════════════════════════════════════════════════════════════════════
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      {children}
    </div>
  );
}
