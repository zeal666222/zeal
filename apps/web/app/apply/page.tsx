// apps/web/app/apply/page.tsx
// Consultants build their profile on the admin portal.
// Web /apply is a redirect to the consultant studio.
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

export default function ApplyRedirect() {
  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  redirect(adminUrl ? `${adminUrl}/consultant/dashboard` : "/explore");
}
