# Manual Patches — Auth Rewrite

The setup.sh script writes all files automatically. The patches below
must be applied manually because they modify existing code that may
have user customizations.

────────────────────────────────────────────────────────────────────────────
PATCH 1 — apps/admin/actions/auth.ts (role-aware login destination)
────────────────────────────────────────────────────────────────────────────

Inside `adminLoginAction()`, replace the final block (after
`writeAudit({...})` and before `const destination = resolveDestination(...)`)
with:

```ts
  // Self-heal: ensure Consultant row exists
  if (effectiveRole === "CLIENT_ADMIN") {
    try {
      const { ensureConsultantRow } = await import("@zeal/database/server");
      await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 });
    } catch (err) {
      console.warn("[adminLogin] consultant self-heal failed:", err);
    }
    return { success: true, destination: "/consultant/dashboard" };
  }

  // Admin roles → admin console
  return { success: true, destination: "/dashboard" };
