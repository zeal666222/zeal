import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const type = url.searchParams.get("type") || "all"; // all, consultant, post, hashtag

  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const results: unknown[] = [];

  // Search consultants
  if (type === "all" || type === "consultant") {
    const consultants = await prisma.consultant.findMany({
      where: {
        OR: [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { username: { contains: q, mode: "insensitive" } } },
          { specialties: { hasSome: [q] } },
        ],
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      take: 10,
    });
    results.push(
      ...consultants.map((c: any) => ({
        id: c.id,
        type: "consultant",
        label: c.user.name || c.user.username,
        description: c.specialties?.join(", ") || "",
        avatar: c.user.avatar,
      }))
    );
  }

  // Search posts
  if (type === "all" || type === "post") {
    const posts = await prisma.post.findMany({
      where: {
        content: { contains: q, mode: "insensitive" },
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
      take: 5,
    });
    results.push(
      ...posts.map((p: any) => ({
        id: p.id,
        type: "post",
        label: p.content.substring(0, 50),
        description: p.author.username,
        avatar: p.author.avatar,
      }))
    );
  }

  // Search hashtags – simple static list for MVP
  if (type === "all" || type === "hashtag") {
    const hashtags = ["spiritual", "wellness", "meditation", "yoga", "astrology"];
    const filtered = hashtags.filter((h) => h.includes(q.toLowerCase()));
    results.push(
      ...filtered.map((h) => ({
        id: h,
        type: "hashtag",
        label: `#${h}`,
        description: `Posts tagged with ${h}`,
        avatar: null,
      }))
    );
  }

  return NextResponse.json({ results });
});
