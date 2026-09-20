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

  const rl = await checkRateLimit(aiRateLimiter, `matchmaking:${user.id}`);
  if (!rl.ok) return new Response("Please wait a moment, then try again.", {status: 429, headers: rl.headers});

  try {
    const {name1, dob1, name2, dob2} = await req.json();
    if (!name1 || !dob1 || !name2 || !dob2) {
      return NextResponse.json({error: "All names and dates are required."}, {status: 400});
    }

    const systemPrompt = `You are an expert in Synastry and Vedic Guna Milan compatibility. Analyze the bond between ${name1} (DOB: ${dob1}) and ${name2} (DOB: ${dob2}). Provide a compatibility score out of 36 Gunas conceptually, followed by emotional, communication, and long-term outlooks.`;
    const userPrompt = "Perform a complete compatibility and relationship synthesis analysis.";

    const stream = await generateFaultTolerantStream(systemPrompt, userPrompt);
    // Attach rate-limit headers to the streamed response
    const headers = new Headers(stream.headers);
    for (const [k, v] of Object.entries(rl.headers ?? {})) headers.set(k, v);
    return new Response(stream.body, {status: stream.status, headers});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat is taking a brief pause.";
    return NextResponse.json({error: message}, {status: 500});
  }
}
