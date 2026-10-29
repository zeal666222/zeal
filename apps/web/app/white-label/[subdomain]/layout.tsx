// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Layout — Industry-grade consultant landing page shell
// ═══════════════════════════════════════════════════════════════════════════════
import { notFound } from "next/navigation";
import { createAdminClient } from "@zeal/database/server";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Globe, Mail, MessageCircle, Phone, Star } from "lucide-react";

interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  heroGradient: string;
  fontFamily: string;
}

interface ConsultantRow {
  id: string;
  theme: unknown;
  subdomain: string | null;
  subdomainActive: boolean | null;
  bio: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  category: string;
  rating: number;
  totalConsultations: number;
  perMinuteRate: number;
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  user:
    | { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean }
    | { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean }[]
    | null;
  page: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroImageUrl: string | null;
    coverImageUrl: string | null;
    aboutHeading: string | null;
    aboutBody: string | null;
    showServices: boolean;
    servicesHeading: string | null;
    showTestimonials: boolean;
    showContact: boolean;
    contactWhatsapp: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    themeConfig: Record<string, unknown> | null;
  } | null;
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#7c3aed",
  accentColor: "#a855f7",
  heroGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  fontFamily: "inherit",
};

function normalizeTheme(raw: unknown, pageTheme?: Record<string, unknown> | null): ThemeConfig {
  const base = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const pg = pageTheme && typeof pageTheme === "object" ? pageTheme : {};
  return {
    primaryColor: (typeof pg.primaryColor === "string" ? pg.primaryColor : typeof base.primaryColor === "string" ? base.primaryColor : DEFAULT_THEME.primaryColor),
    accentColor: (typeof pg.accentColor === "string" ? pg.accentColor : typeof base.accentColor === "string" ? base.accentColor : DEFAULT_THEME.accentColor),
    heroGradient: (typeof pg.heroGradient === "string" ? pg.heroGradient : DEFAULT_THEME.heroGradient),
    fontFamily: (typeof pg.fontFamily === "string" ? pg.fontFamily : DEFAULT_THEME.fontFamily),
  };
}

interface Props {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}

export default async function WhiteLabelLayout({ children, params }: Props) {
  const { subdomain } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("Consultant")
    .select(`
      id, theme, subdomain, "subdomainActive", bio, specialties, languages,
      category, rating, "totalConsultations", "perMinuteRate",
      "chatRate", "audioRate", "videoRate",
      user:User!userId(id, name, username, avatar, is_online),
      page:ConsultantPage(
        "heroTitle", "heroSubtitle", "heroImageUrl", "coverImageUrl",
        "aboutHeading", "aboutBody", "showServices", "servicesHeading",
        "showTestimonials", "showContact", "contactWhatsapp", "contactEmail",
        "contactPhone", "seoTitle", "seoDescription", "themeConfig"
      )
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  if (!user) notFound();

  const page = Array.isArray(row.page) ? row.page[0] : row.page;
  const theme = normalizeTheme(row.theme, page?.themeConfig);
  const displayName = user.name || user.username || "Consultant";
  const initial = displayName.charAt(0).toUpperCase();

  const cssVars = {
    "--wl-primary": theme.primaryColor,
    "--wl-accent": theme.accentColor,
    "--wl-hero-gradient": theme.heroGradient,
    "--wl-font": theme.fontFamily,
  } as CSSProperties;

  const seoTitle = page?.seoTitle || `${displayName} — Spiritual Consultant`;
  const seoDesc = page?.seoDescription || row.bio || `Book a session with ${displayName}`;

  return (
    <div style={cssVars} className="min-h-[100dvh] bg-[#0a0a1a] text-white antialiased">
      {/* ═══ HEADER ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href={`/white-label/${subdomain}`} className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-white/20 transition-all">
              {user.avatar ? (
                <Image src={user.avatar} alt={displayName} fill sizes="40px" className="object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {initial}
                </div>
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-tight">{displayName}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                {row.category.replace(/_/g, " ")}
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href={`/white-label/${subdomain}`}
              className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors px-2 sm:px-3 py-2"
            >
              Home
            </Link>
            <Link
              href={`/white-label/${subdomain}/services`}
              className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors px-2 sm:px-3 py-2"
            >
              Services
            </Link>
            <Link
              href={`/white-label/${subdomain}/book`}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}
            >
              Book Now
            </Link>
          </nav>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="pt-16">{children}</main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.06] bg-[#0a0a1a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {initial}
                </div>
                <span className="font-bold text-white">{displayName}</span>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">
                {row.bio ? row.bio.slice(0, 150) + (row.bio.length > 150 ? "..." : "") : `Professional ${row.category.toLowerCase().replace(/_/g, " ")} services.`}
              </p>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-4">Quick Links</h4>
              <div className="space-y-2">
                <Link href={`/white-label/${subdomain}`} className="block text-sm text-white/50 hover:text-white transition-colors">Home</Link>
                <Link href={`/white-label/${subdomain}/services`} className="block text-sm text-white/50 hover:text-white transition-colors">Services</Link>
                <Link href={`/white-label/${subdomain}/book`} className="block text-sm text-white/50 hover:text-white transition-colors">Book Session</Link>
              </div>
            </div>

            {/* Contact */}
            {page?.showContact && (page.contactWhatsapp || page.contactEmail || page.contactPhone) && (
              <div>
                <h4 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-4">Contact</h4>
                <div className="space-y-2">
                  {page.contactWhatsapp && (
                    <a href={`https://wa.me/${page.contactWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/50 hover:text-emerald-400 transition-colors">
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                  {page.contactEmail && (
                    <a href={`mailto:${page.contactEmail}`}
                      className="flex items-center gap-2 text-sm text-white/50 hover:text-purple-400 transition-colors">
                      <Mail size={14} /> {page.contactEmail}
                    </a>
                  )}
                  {page.contactPhone && (
                    <a href={`tel:${page.contactPhone}`}
                      className="flex items-center gap-2 text-sm text-white/50 hover:text-blue-400 transition-colors">
                      <Phone size={14} /> {page.contactPhone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} {displayName}. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <Globe size={12} className="text-white/20" />
              <span className="text-xs text-white/20">Powered by Siddhi</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { subdomain } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("Consultant")
    .select(`
      subdomain, "subdomainActive",
      page:ConsultantPage("seoTitle", "seoDescription", "seoKeywords"),
      user:User!userId(name, username, avatar)
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (!data) return { title: "Not Found" };

  const row = data as unknown as {
    page: { seoTitle: string | null; seoDescription: string | null; seoKeywords: string[] | null } | null | Array<{ seoTitle: string | null; seoDescription: string | null; seoKeywords: string[] | null }>;
    user: { name: string | null; username: string; avatar: string | null } | Array<{ name: string | null; username: string; avatar: string | null }>;
  };

  const page = Array.isArray(row.page) ? row.page[0] : row.page;
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  const name = user?.name ?? user?.username ?? "Consultant";

  return {
    title: page?.seoTitle || `${name} — Spiritual Consultant`,
    description: page?.seoDescription || `Book a session with ${name}`,
    keywords: page?.seoKeywords?.join(", ") || "astrology, consultation, spiritual",
    openGraph: {
      title: page?.seoTitle || `${name} — Spiritual Consultant`,
      description: page?.seoDescription || `Book a session with ${name}`,
      images: user?.avatar ? [{ url: user.avatar }] : [],
    },
  };
}
