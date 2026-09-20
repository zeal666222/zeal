import { createAdminClient } from "@zeal/database/server";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchHomeData() {
  const admin = createAdminClient();

  const [aiRes, expertsRes, postsRes] = await Promise.all([
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
        user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)
      `)
      .eq("status", "VERIFIED")
      .eq("isActive", true)
      .order("sparkScore", { ascending: false })
      .limit(8),
    admin
      .from("Post")
      .select(`
        id, content, "mediaUrls", "cheerCount", "commentCount", "createdAt",
        author:User!Post_authorId_fkey(id, name, username, avatar)
      `)
      .eq("isFlagged", false)
      .order("createdAt", { ascending: false })
      .limit(12),
  ]);

  return {
    aiConsultants: aiRes.data ?? [],
    experts: expertsRes.data ?? [],
    posts: postsRes.data ?? [],
  };
}

export default async function HomePage() {
  const data = await fetchHomeData();
  return <HomeClient {...data} />;
}
