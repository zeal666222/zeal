import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PageSchema = z.object({
  heroTitle: z.string().max(200).optional(),
  heroSubtitle: z.string().max(500).optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  coverImageUrl: z.string().max(500).nullable().optional(),
  aboutHeading: z.string().max(200).optional(),
  aboutBody: z.string().max(5000).optional(),
  showServices: z.boolean().optional(),
  servicesHeading: z.string().max(100).optional(),
  showTestimonials: z.boolean().optional(),
  testimonialsHeading: z.string().max(100).optional(),
  showContact: z.boolean().optional(),
  contactWhatsapp: z.string().max(30).nullable().optional(),
  contactEmail: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  seoTitle: z.string().max(100).optional(),
  seoDescription: z.string().max(300).optional(),
  seoKeywords: z.array(z.string().max(50)).max(20).optional(),
  themeConfig: z.record(z.string(), z.unknown()).optional(),
  customSections: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  isPublished: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: consultant } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ error: "No consultant profile" }, { status: 404 });
  }

  const { data: page, error } = await admin
    .from("ConsultantPage")
    .select("*")
    .eq("consultantId", consultant.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch landing page" }, { status: 500 });
  }

  return NextResponse.json({ success: true, page });
}

export async function PUT(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: consultant } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ error: "No consultant profile" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const { error } = await admin.rpc("upsert_consultant_page", {
    p_consultant_id: consultant.id,
    p_hero_title: d.heroTitle ?? null,
    p_hero_subtitle: d.heroSubtitle ?? null,
    p_hero_image_url: d.heroImageUrl ?? null,
    p_cover_image_url: d.coverImageUrl ?? null,
    p_about_heading: d.aboutHeading ?? null,
    p_about_body: d.aboutBody ?? null,
    p_show_services: d.showServices ?? null,
    p_services_heading: d.servicesHeading ?? null,
    p_show_testimonials: d.showTestimonials ?? null,
    p_testimonials_heading: d.testimonialsHeading ?? null,
    p_show_contact: d.showContact ?? null,
    p_contact_whatsapp: d.contactWhatsapp ?? null,
    p_contact_email: d.contactEmail ?? null,
    p_contact_phone: d.contactPhone ?? null,
    p_seo_title: d.seoTitle ?? null,
    p_seo_description: d.seoDescription ?? null,
    p_seo_keywords: d.seoKeywords ?? null,
    p_theme_config: d.themeConfig ?? null,
    p_custom_sections: d.customSections ?? null,
    p_is_published: d.isPublished ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to save landing page" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
