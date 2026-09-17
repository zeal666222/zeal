import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const { sign } = await request.json();
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ success: true, reading: `Horoscope for ${sign}: Today brings powerful clarity and cosmic alignment in career and relationship sectors.` });
    }
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "You are an expert astrologer providing daily horoscopes." }, { role: "user", content: `Provide a detailed daily astrological horoscope for ${sign}.` }],
        temperature: 0.7, max_tokens: 800
      })
    });
    const data = await res.json();
    return NextResponse.json({ success: true, reading: data.choices?.[0]?.message?.content || "Horoscope computed." });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}
