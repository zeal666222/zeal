# Manual Patches — Consultant Flow + Realtime

The setup.sh script writes all files automatically EXCEPT these that
must be edited manually (to avoid overwriting your customizations).

---

## PATCH 1 — apps/web/middleware.ts

Insert AFTER the `isPublic(pathname)` check and BEFORE `requiresAuth`:

```ts
// Bounce CLIENT_ADMIN users to the admin portal
if (user && !isPublic(pathname) && requiresAuth(pathname)) {
  const role = (user.app_metadata?.role as string) ?? "USER";
  if (role === "CLIENT_ADMIN") {
    const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
    if (adminUrl) return NextResponse.redirect(`${adminUrl}/consultant/dashboard`);
  }
}
