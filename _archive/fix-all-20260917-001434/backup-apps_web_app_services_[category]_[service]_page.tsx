import { notFound } from "next/navigation";
import { prisma } from "@zeal/database";
import { getService } from "@/lib/services";
import { ServicePageClient } from "./ServicePageClient";
import type { ConsultantProfile } from "@zeal/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ServicePageProps {
  params: Promise<{ category: string; service: string }>;
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { category, service: serviceSlug } = await params;
  const service = getService(category, serviceSlug);
  if (!service) return { title: "Service not found" };

  return {
    title: `${service.displayName} – ${service.categoryName} | Zeal`,
    description: service.description,
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { category, service: serviceSlug } = await params;
  const service = getService(category, serviceSlug);
  if (!service) notFound();

  // ─── Fetch human consultants ──────────────────────────────────────────
  let humanConsultants: Awaited<ReturnType<typeof fetchHumanConsultants>> = [];
  try {
    humanConsultants = await fetchHumanConsultants(service);
  } catch (err) {
    console.error("[ServicePage] Human consultants failed:", err);
  }

  // ─── Fetch AI consultants ─────────────────────────────────────────────
  let aiConsultants: Awaited<ReturnType<typeof fetchAiConsultants>> = [];
  try {
    aiConsultants = await fetchAiConsultants(service);
  } catch (err) {
    console.error("[ServicePage] AI consultants failed:", err);
  }

  // ─── Merge into a single list, humans first, then AI ──────────────────
  const humanProfiles: ConsultantProfile[] = humanConsultants.map((c: any) => ({
    id: c.id,
    userId: c.userId,
    name: c.user.name || c.user.username,
    username: c.user.username,
    bio: c.bio || "",
    avatar: c.user.avatar || "",
    category: c.category as never,
    isVerified: c.isVerified,
    isOnline: c.isActive,
    perMinuteRate: c.perMinuteRate,
    experience: 0,
    rating: c.rating,
    totalConsultations: c.totalConsultations,
    sparks: 0,
    languages: c.languages || [],
    specialties: c.specialties || [],
    faith: c.faith as never,
    isAI: false,
  }));

  const aiProfiles: ConsultantProfile[] = aiConsultants.map((c: any) => ({
    id: c.id,
    userId: `ai-${c.id}`,
    name: c.name,
    username: c.username,
    bio: c.bio || "",
    avatar: c.avatar || "",
    category: c.category as never,
    isVerified: true,
    isOnline: true,
    perMinuteRate: c.perMinuteRate,
    experience: c.experience || 100,
    rating: c.rating,
    totalConsultations: c.totalConsultations,
    sparks: c.sparks || 0,
    languages: c.languages || [],
    specialties: c.specialties || [],
    faith: "HINDU" as never,
    isAI: true,
    isPaid: c.isPaid,
  }));

  // Combine: humans first (sorted by rating), then AI
  const allProfiles = [...humanProfiles, ...aiProfiles];

  // Collect languages for filter bar
  const languageSet = new Set<string>();
  for (const c of allProfiles) {
    for (const lang of c.languages || []) languageSet.add(lang);
  }
  const languages = Array.from(languageSet).sort();

  return (
    <ServicePageClient
      service={service}
      consultants={allProfiles}
      languages={languages}
      humanCount={humanProfiles.length}
      aiCount={aiProfiles.length}
    />
  );
}

// ─── Human consultants ─────────────────────────────────────────────────
async function fetchHumanConsultants(service: ReturnType<typeof getService>) {
  if (!service) return [];

  const exactMatches = await prisma.consultant.findMany({
    where: {
      category: service.category as never,
      isActive: true,
      status: "VERIFIED",
      specialties: { hasSome: service.specialties },
    },
    include: {
      user: { select: { id: true, name: true, username: true, avatar: true } },
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  if (exactMatches.length > 0) return exactMatches;

  return prisma.consultant.findMany({
    where: {
      category: service.category as never,
      isActive: true,
      status: "VERIFIED",
    },
    include: {
      user: { select: { id: true, name: true, username: true, avatar: true } },
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
}

// ─── AI consultants ────────────────────────────────────────────────────
async function fetchAiConsultants(service: ReturnType<typeof getService>) {
  if (!service) return [];

  // Try exact category match first
  const matches = await prisma.aIConsultant.findMany({
    where: {
      isActive: true,
      category: service.category,
    },
    orderBy: [{ isFeatured: "desc" }, { rating: "desc" }],
    take: 20,
  });

  if (matches.length > 0) return matches;

  // Fallback: featured AI consultants from any category
  return prisma.aIConsultant.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { rating: "desc" },
    take: 5,
  });
}
