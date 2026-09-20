import {createServerClientFromCookies} from "@zeal/database/server";
import {checkRateLimit, aiRateLimiter} from "@/lib/rate-limit";
import {generateFaultTolerantStream} from "@/lib/ai/router";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error: "Please sign in to continue."}, {status: 401});

  const rl = await checkRateLimit(aiRateLimiter, `palmistry:${user.id}`);
  if (!rl.ok) return new Response("Please wait a moment, then try again.", {status: 429, headers: rl.headers});

  try {
    const {handSide, primaryFocus} = await req.json();

    const systemPrompt = `You are an expert Palmistry reader combining ancient chiromancy with modern psychological framing. Analyze the user's ${handSide || "Right"} hand palm scan with a focus on '${primaryFocus || "Life and Career"}'. Describe the main lines (Heart, Head, Life, Fate) with depth, nuance, and inspiring clarity.`;
    const userPrompt = "Provide my digital palm reading based on my hand analysis.";

    const stream = await generateFaultTolerantStream(systemPrompt, userPrompt);
    const headers = new Headers(stream.headers);
    for (const [k, v] of Object.entries(rl.headers ?? {})) headers.set(k, v);
    return new Response(stream.body, {status: stream.status, headers});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat is taking a brief pause.";
    return NextResponse.json({error: message}, {status: 500});
  }
}
