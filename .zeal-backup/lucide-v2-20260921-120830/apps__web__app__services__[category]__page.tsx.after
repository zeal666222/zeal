import { createAdminClient } from "@zeal/database/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, Radio, Sparkles, Star } from "lucide-react";
import { CATEGORY_ID_TO_NAME, CATEGORY_ID_TO_PRISMA } from "@/lib/services/slug";
import { CategoryHubClient } from "./CategoryHubClient";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ category: string }>; }

export async function generateMetadata({ params }: Props) {
  const { category } = await params;
  const name = CATEGORY_ID_TO_NAME[category] ?? category;
  return { title: `${name} — Zeal` };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const name = CATEGORY_ID_TO_NAME[category];
  const prismaCat = CATEGORY_ID_TO_PRISMA[category];
  if (!name || !prismaCat) notFound();

  const admin = createAdminClient();

  const [humansRes, aiRes] = await Promise.all([
    admin
      .from("Consultant")
      .select(`
        id, category, specialties, languages, bio, "perMinuteRate", rating,
        "totalConsultations", "sparkScore", "isActive", "isVerified", subdomain,
        user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)
      `)
      .eq("category", prismaCat)
      .eq("status", "VERIFIED")
      .eq("isActive", true)
      .order("sparkScore", { ascending: false })
      .limit(40),
    admin
      .from("AIConsultant")
      .select("*")
      .eq("isActive", true)
      .ilike("category", `%${prismaCat}%`)
      .limit(10),
  ]);

  const humans = humansRes.data ?? [];
  const ai = aiRes.data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/services"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] mb-6"
      >
        <ArrowLeft size={14} /> All categories
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-black text-[var(--color-foreground)] tracking-tight">
          {name}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-2">
          {humans.length} verified guide{humans.length !== 1 ? "s" : ""} · {ai.length} AI consultant{ai.length !== 1 ? "s" : ""}
        </p>
      </div>

      <CategoryHubClient
        categoryId={category}
        categoryName={name}
        initialHumans={humans as never[]}
        initialAi={ai as never[]}
      />
    </div>
  );
}
