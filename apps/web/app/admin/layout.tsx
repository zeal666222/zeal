// apps/web/app/admin/layout.tsx
// Admin portal root layout. Wraps the /admin/* subtree (both anonymous pages
// like /admin/login and gated pages under /admin/(portal)/*). Providers for
// the authenticated console live in the (portal) group layout so anonymous
// pages don't mount them.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Zeal",
  description: "Zeal admin console — moderate consultants, monitor sessions, manage wallet and pricing.",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div id="admin-portal" className="min-h-screen">{children}</div>;
}
