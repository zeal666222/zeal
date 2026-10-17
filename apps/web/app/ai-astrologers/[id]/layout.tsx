import type { Metadata } from "next";
import { createAdminClient } from "@zeal/database/server";
import { PersonSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AiConsultantRow {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  category: string;
  bio: string | null;
  rating: number;
  totalConsultations: number;
  specialties: string[] | null;
  experience: number;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("AIConsultant")
    .select("id, name, username, bio, category, rating, totalConsultations")
    .eq("id", id)
    .maybeSingle();

  if (!data) return {};

  const title = `${data.name} — Free ${data.category.replace(/_/g, " ")} AI Consultant`;
  const description =
    data.bio ||
    `Chat with ${data.name}, a free AI ${data.category.replace(/_/g, " ")} consultant on Zeal. ${data.rating}-star rated with ${data.totalConsultations.toLocaleString()} sessions.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AiConsultantDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("AIConsultant")
    .select("id, name, username, avatar, category, bio, rating, totalConsultations, specialties, experience")
    .eq("id", id)
    .maybeSingle();

  const slug = data?.username || data?.id || id;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "AI Astrologers", url: "/ai-astrologers" },
          { name: data?.name || "Consultant", url: `/ai-astrologers/${slug}` },
        ]}
      />
      {data && (
        <PersonSchema
          name={data.name}
          description={data.bio || `${data.name}, AI ${data.category.replace(/_/g, " ")} consultant on Zeal`}
          url={`/ai-astrologers/${slug}`}
          image={data.avatar || undefined}
          jobTitle={`AI ${data.category.replace(/_/g, " ")}`}
          knowsAbout={data.specialties || undefined}
          rating={
            data.rating > 0
              ? { value: data.rating, count: data.totalConsultations }
              : undefined
          }
        />
      )}
      {children}
    </>
  );
}
