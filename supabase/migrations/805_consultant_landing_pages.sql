-- ═══════════════════════════════════════════════════════════════════════════════
-- 805 — Consultant Landing Pages + Bank Details
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   1. ConsultantPage table: stores landing page content per consultant
--   2. Bank details columns on Consultant: account_number, ifsc, account_holder
--   3. RPCs for CRUD on landing pages
--   4. Realtime publication for ConsultantPage
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Bank details on Consultant ───────────────────────────────────────────
ALTER TABLE public."Consultant"
  ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountHolder" TEXT;

-- ─── 2. ConsultantPage table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."ConsultantPage" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultantId" UUID NOT NULL UNIQUE REFERENCES public."Consultant"(id) ON DELETE CASCADE,
  -- Hero section
  "heroTitle" TEXT,
  "heroSubtitle" TEXT,
  "heroImageUrl" TEXT,
  "coverImageUrl" TEXT,
  -- About section
  "aboutHeading" TEXT,
  "aboutBody" TEXT,
  -- Services showcase
  "showServices" BOOLEAN DEFAULT true,
  "servicesHeading" TEXT DEFAULT 'Services',
  -- Testimonials
  "showTestimonials" BOOLEAN DEFAULT true,
  "testimonialsHeading" TEXT DEFAULT 'What Clients Say',
  -- Contact
  "showContact" BOOLEAN DEFAULT true,
  "contactWhatsapp" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  -- SEO
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "seoKeywords" TEXT[] DEFAULT '{}',
  -- Theme / design
  "themeConfig" JSONB DEFAULT '{}'::jsonb,
  -- Custom sections (array of {type, heading, body, imageUrl} objects)
  "customSections" JSONB DEFAULT '[]'::jsonb,
  -- Status
  "isPublished" BOOLEAN DEFAULT false,
  "publishedAt" TIMESTAMPTZ,
  -- Audit
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultant_page_consultant
  ON public."ConsultantPage"("consultantId");
CREATE INDEX IF NOT EXISTS idx_consultant_page_published
  ON public."ConsultantPage"("isPublished") WHERE "isPublished" = true;

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public."ConsultantPage" ENABLE ROW LEVEL SECURITY;

-- Public read for published pages
DROP POLICY IF EXISTS "consultant_page_public_read" ON public."ConsultantPage";
CREATE POLICY "consultant_page_public_read" ON public."ConsultantPage"
  FOR SELECT TO authenticated, anon, service_role
  USING ("isPublished" = true);

-- Consultant can manage their own page
DROP POLICY IF EXISTS "consultant_page_self_manage" ON public."ConsultantPage";
CREATE POLICY "consultant_page_self_manage" ON public."ConsultantPage"
  FOR ALL TO authenticated
  USING (
    "consultantId" IN (
      SELECT c.id FROM public."Consultant" c WHERE c."userId" = (SELECT auth.uid())
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "consultant_page_admin" ON public."ConsultantPage";
CREATE POLICY "consultant_page_admin" ON public."ConsultantPage"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 4. RPC: Upsert landing page ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_consultant_page(
  p_consultant_id UUID,
  p_hero_title TEXT DEFAULT NULL,
  p_hero_subtitle TEXT DEFAULT NULL,
  p_hero_image_url TEXT DEFAULT NULL,
  p_cover_image_url TEXT DEFAULT NULL,
  p_about_heading TEXT DEFAULT NULL,
  p_about_body TEXT DEFAULT NULL,
  p_show_services BOOLEAN DEFAULT NULL,
  p_services_heading TEXT DEFAULT NULL,
  p_show_testimonials BOOLEAN DEFAULT NULL,
  p_testimonials_heading TEXT DEFAULT NULL,
  p_show_contact BOOLEAN DEFAULT NULL,
  p_contact_whatsapp TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_seo_title TEXT DEFAULT NULL,
  p_seo_description TEXT DEFAULT NULL,
  p_seo_keywords TEXT[] DEFAULT NULL,
  p_theme_config JSONB DEFAULT NULL,
  p_custom_sections JSONB DEFAULT NULL,
  p_is_published BOOLEAN DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_is_admin BOOLEAN;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Check if user is admin or owns the consultant
  SELECT EXISTS(
    SELECT 1 FROM public."User" WHERE id = v_uid
    AND upper(coalesce(role::text, 'USER')) IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  ) INTO v_is_admin;

  IF NOT v_is_admin AND NOT EXISTS(
    SELECT 1 FROM public."Consultant" WHERE id = p_consultant_id AND "userId" = v_uid
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  INSERT INTO public."ConsultantPage" (
    "consultantId", "heroTitle", "heroSubtitle", "heroImageUrl", "coverImageUrl",
    "aboutHeading", "aboutBody", "showServices", "servicesHeading",
    "showTestimonials", "testimonialsHeading", "showContact",
    "contactWhatsapp", "contactEmail", "contactPhone",
    "seoTitle", "seoDescription", "seoKeywords",
    "themeConfig", "customSections", "isPublished", "publishedAt"
  ) VALUES (
    p_consultant_id,
    COALESCE(p_hero_title, ''),
    COALESCE(p_hero_subtitle, ''),
    p_hero_image_url,
    p_cover_image_url,
    COALESCE(p_about_heading, ''),
    COALESCE(p_about_body, ''),
    COALESCE(p_show_services, true),
    COALESCE(p_services_heading, 'Services'),
    COALESCE(p_show_testimonials, true),
    COALESCE(p_testimonials_heading, 'What Clients Say'),
    COALESCE(p_show_contact, true),
    p_contact_whatsapp,
    p_contact_email,
    p_contact_phone,
    COALESCE(p_seo_title, ''),
    COALESCE(p_seo_description, ''),
    COALESCE(p_seo_keywords, '{}'),
    COALESCE(p_theme_config, '{}'::jsonb),
    COALESCE(p_custom_sections, '[]'::jsonb),
    COALESCE(p_is_published, false),
    CASE WHEN COALESCE(p_is_published, false) THEN NOW() ELSE NULL END
  )
  ON CONFLICT ("consultantId") DO UPDATE SET
    "heroTitle" = COALESCE(p_hero_title, public."ConsultantPage"."heroTitle"),
    "heroSubtitle" = COALESCE(p_hero_subtitle, public."ConsultantPage"."heroSubtitle"),
    "heroImageUrl" = COALESCE(p_hero_image_url, public."ConsultantPage"."heroImageUrl"),
    "coverImageUrl" = COALESCE(p_cover_image_url, public."ConsultantPage"."coverImageUrl"),
    "aboutHeading" = COALESCE(p_about_heading, public."ConsultantPage"."aboutHeading"),
    "aboutBody" = COALESCE(p_about_body, public."ConsultantPage"."aboutBody"),
    "showServices" = COALESCE(p_show_services, public."ConsultantPage"."showServices"),
    "servicesHeading" = COALESCE(p_services_heading, public."ConsultantPage"."servicesHeading"),
    "showTestimonials" = COALESCE(p_show_testimonials, public."ConsultantPage"."showTestimonials"),
    "testimonialsHeading" = COALESCE(p_testimonials_heading, public."ConsultantPage"."testimonialsHeading"),
    "showContact" = COALESCE(p_show_contact, public."ConsultantPage"."showContact"),
    "contactWhatsapp" = COALESCE(p_contact_whatsapp, public."ConsultantPage"."contactWhatsapp"),
    "contactEmail" = COALESCE(p_contact_email, public."ConsultantPage"."contactEmail"),
    "contactPhone" = COALESCE(p_contact_phone, public."ConsultantPage"."contactPhone"),
    "seoTitle" = COALESCE(p_seo_title, public."ConsultantPage"."seoTitle"),
    "seoDescription" = COALESCE(p_seo_description, public."ConsultantPage"."seoDescription"),
    "seoKeywords" = COALESCE(p_seo_keywords, public."ConsultantPage"."seoKeywords"),
    "themeConfig" = COALESCE(p_theme_config, public."ConsultantPage"."themeConfig"),
    "customSections" = COALESCE(p_custom_sections, public."ConsultantPage"."customSections"),
    "isPublished" = COALESCE(p_is_published, public."ConsultantPage"."isPublished"),
    "publishedAt" = CASE
      WHEN COALESCE(p_is_published, false) AND NOT public."ConsultantPage"."isPublished" THEN NOW()
      ELSE public."ConsultantPage"."publishedAt"
    END,
    "updatedAt" = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.upsert_consultant_page(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT,
  BOOLEAN, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[],
  JSONB, JSONB, BOOLEAN
) TO authenticated, service_role;

-- ─── 5. RPC: Get landing page by consultant ID ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_consultant_page(p_consultant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_page RECORD;
BEGIN
  SELECT * INTO v_page FROM public."ConsultantPage"
  WHERE "consultantId" = p_consultant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'page', NULL);
  END IF;

  RETURN jsonb_build_object('success', true, 'page', jsonb_build_object(
    'id', v_page.id,
    'consultantId', v_page."consultantId",
    'heroTitle', v_page."heroTitle",
    'heroSubtitle', v_page."heroSubtitle",
    'heroImageUrl', v_page."heroImageUrl",
    'coverImageUrl', v_page."coverImageUrl",
    'aboutHeading', v_page."aboutHeading",
    'aboutBody', v_page."aboutBody",
    'showServices', v_page."showServices",
    'servicesHeading', v_page."servicesHeading",
    'showTestimonials', v_page."showTestimonials",
    'testimonialsHeading', v_page."testimonialsHeading",
    'showContact', v_page."showContact",
    'contactWhatsapp', v_page."contactWhatsapp",
    'contactEmail', v_page."contactEmail",
    'contactPhone', v_page."contactPhone",
    'seoTitle', v_page."seoTitle",
    'seoDescription', v_page."seoDescription",
    'seoKeywords', v_page."seoKeywords",
    'themeConfig', v_page."themeConfig",
    'customSections', v_page."customSections",
    'isPublished', v_page."isPublished",
    'publishedAt', v_page."publishedAt",
    'createdAt', v_page."createdAt",
    'updatedAt', v_page."updatedAt"
  ));
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_consultant_page(UUID) TO authenticated, anon, service_role;

-- ─── 6. RPC: Update bank details ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_consultant_bank(
  p_account_number TEXT,
  p_ifsc TEXT,
  p_account_holder TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_consultant_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_consultant_id FROM public."Consultant" WHERE "userId" = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_consultant_profile');
  END IF;

  UPDATE public."Consultant"
  SET "bankAccountNumber" = p_account_number,
      "bankIfsc" = p_ifsc,
      "bankAccountHolder" = p_account_holder,
      "updatedAt" = NOW()
  WHERE id = v_consultant_id;

  RETURN jsonb_build_object('success', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.update_consultant_bank(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ─── 7. RPC: Get bank details (consultant own only) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_consultant_bank()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT "bankAccountNumber", "bankIfsc", "bankAccountHolder"
  INTO v_row
  FROM public."Consultant" WHERE "userId" = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_consultant_profile');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'accountNumber', v_row."bankAccountNumber",
    'ifsc', v_row."bankIfsc",
    'accountHolder', v_row."bankAccountHolder"
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_consultant_bank() TO authenticated, service_role;

-- ─── 8. Realtime publication ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'consultant_pages'
  ) THEN
    CREATE PUBLICATION consultant_pages FOR TABLE public."ConsultantPage";
  END IF;
END $$;

-- ─── 9. Auto-update timestamp trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consultant_page_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_consultant_page_updated_at ON public."ConsultantPage";
CREATE TRIGGER trg_consultant_page_updated_at
  BEFORE UPDATE ON public."ConsultantPage"
  FOR EACH ROW EXECUTE FUNCTION public.consultant_page_updated_at();
