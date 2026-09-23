// ZEAL_PHASE1_V1
import { createAdminClient } from "@zeal/database/server";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchHomeData() {
  const admin = createAdminClient();

  const [aiRes, expertsRes, postsRes, catCountRes, consultantCountRes] =
    await Promise.all([
      admin
        .from("AIConsultant")
        .select("*")
        .eq("isActive", true)
        .order("isFeatured", { ascending: false })
        .order("rating", { ascending: false })
        .limit(6),
      admin
        .from("Consultant")
        .select(`
          id, category, rating, "sparkScore", "perMinuteRate", specialties,
          languages, "totalConsultations",
          user:User!userId(id, name, username, avatar, is_online)
        `)
        .eq("status", "VERIFIED")
        .eq("isActive", true)
        .order("sparkScore", { ascending: false })
        .limit(24),
      admin
        .from("Post")
        .select(`
          id, content, "mediaUrls", "cheerCount", "commentCount", "createdAt",
          author:User!authorId(id, name, username, avatar)
        `)
        .eq("isFlagged", false)
        .order("createdAt", { ascending: false })
        .limit(12),
      admin
        .from("Category")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      admin
        .from("Consultant")
        .select("*", { count: "exact", head: true })
        .eq("status", "VERIFIED")
        .eq("isActive", true),
    ]);

  const aiConsultants = aiRes.data ?? [];
  const experts = expertsRes.data ?? [];
  const posts = postsRes.data ?? [];

  return {
    aiConsultants,
    experts,
    posts,
    stats: {
      traditions: catCountRes.count ?? 0,
      consultants: consultantCountRes.count ?? 0,
      aiConsultants: aiConsultants.length,
    },
  };
}

export default async function HomePage() {
  const data = await fetchHomeData();
  return <HomeClient {...data} />;
}
