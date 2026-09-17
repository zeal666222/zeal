import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler } from "@/lib/errors";

// Static catalogue — quests are content, not user data. The progress
// endpoint is what reflects per-user state.
const CATALOGUE = [
  { id: "daily-post",       name: "Daily Post",       description: "Create a post today",       type: "daily",  requirement: 1,  reward: 25,  icon: "📝" },
  { id: "daily-cheer",      name: "Social Butterfly", description: "Cheer 10 posts",            type: "daily",  requirement: 10, reward: 30,  icon: "🦋" },
  { id: "daily-comment",    name: "Community Builder",description: "Comment on 5 posts",        type: "daily",  requirement: 5,  reward: 20,  icon: "💬" },
  { id: "daily-follow",     name: "Connector",        description: "Follow 3 consultants",      type: "daily",  requirement: 3,  reward: 15,  icon: "🤝" },
  { id: "weekly-streak",    name: "Weekly Streak",    description: "Log in 7 days in a row",    type: "weekly", requirement: 7,  reward: 100, icon: "🔥" },
  { id: "weekly-session",   name: "Deep Work",        description: "Complete 3 sessions",       type: "weekly", requirement: 3,  reward: 75,  icon: "🧘" },
];

export const GET = withErrorHandler(async () => {
  // Optionally enrich with DB counts if a Quest model exists; fall back to catalogue.
  try {
    const prismaAny = prisma as unknown as { quest?: { findMany: (args: unknown) => Promise<unknown[]> } };
    if (prismaAny.quest) {
      const rows = await prismaAny.quest.findMany({ where: { isActive: true } });
      if (Array.isArray(rows) && rows.length > 0) {
        return NextResponse.json(rows);
      }
    }
  } catch { /* fall through */ }

  return NextResponse.json(CATALOGUE);
});

