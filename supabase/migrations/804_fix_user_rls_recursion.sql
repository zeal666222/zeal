-- Fix infinite recursion in user_self_update policy on "User" table.
-- The WITH CHECK clause had sub-SELECTs on public."User" which, under
-- FORCE ROW LEVEL SECURITY, caused PostgreSQL to detect infinite recursion.
-- Solution: extract the immutable-field check into a SECURITY DEFINER function
-- that bypasses RLS for its own reads.
-- Idempotent: safe to re-run. Apply via Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.user_protected_fields_unchanged()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IS NOT DISTINCT FROM (
        SELECT role FROM public."User" WHERE id = (SELECT auth.uid())
      )
      AND u.sparks IS NOT DISTINCT FROM (
        SELECT sparks FROM public."User" WHERE id = (SELECT auth.uid())
      )
      AND u."isVerified" IS NOT DISTINCT FROM (
        SELECT "isVerified" FROM public."User" WHERE id = (SELECT auth.uid())
      )
      AND u."sparkScore" IS NOT DISTINCT FROM (
        SELECT "sparkScore" FROM public."User" WHERE id = (SELECT auth.uid())
      )
  );
$$;

DROP POLICY IF EXISTS "user_self_update" ON public."User";

CREATE POLICY "user_self_update" ON public."User"
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND public.user_protected_fields_unchanged()
  );
