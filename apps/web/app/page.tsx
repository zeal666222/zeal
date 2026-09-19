import { createAdminClient } from "@zeal/database/server";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ConsultantRow {
  id: string;
  category: string;
  rating: number | null;
  sparkScore: number | null;
  perMinuteRate: number | null;
  specialties: string[] | null;
  user: { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean | null } | null;
}

interface AIConsultantRow {
  id: string;
  name: string;
  username: string;
  avatar: string;
  category: string;
  bio: string;
  rating: number;
  isPaid: boolean;
  perMinuteRate: number;
  specialties: string[] | null;
  isFeatured: boolean;
}

interface PostRow {
  id: string;
  content: string;
  created_at: string;
  author: { name: string | null; avatar: string | null } | null;
}

async function fetchHomeData() {
  const admin = createAdminClient();

  const [consultantsRes, aiRes, postsRes] = await Promise.all([
    admin
      .from("Consultant")
      .select(`
        id, category, rating, "sparkScore", "perMinuteRate", specialties,
        user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)
      `)
      .eq("status", "VERIFIED")
      .eq("isActive", true)
      .order("sparkScore", { ascending: false })
      .limit(4),
    admin
      .from("AIConsultant")
      .select("*")
      .eq("isActive", true)
      .order("isFeatured", { ascending: false })
      .order("rating", { ascending: false })
      .limit(6),
    admin
      .from("Post")
      .select(`
        id, content, created_at,
        author:User!Post_authorId_fkey(name, avatar)
      `)
      .eq("isFlagged", false)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  return {
    consultants: (consultantsRes.data ?? []) as unknown as ConsultantRow[],
    aiConsultants: (aiRes.data ?? []) as AIConsultantRow[],
    posts: (postsRes.data ?? []) as unknown as PostRow[],
  };
}

export default async function HomePage() {
  const data = await fetchHomeData();
  return <HomeClient {...data} />;
}
