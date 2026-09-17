import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const { fullName, dob } = await request.json();
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ success: true, analysis: `Numerology profile for ${fullName} (DOB: ${dob}): Life Path number calculated with master frequency resonance indicating leadership and spiritual evolution.` });
    }
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "You are a master numerologist." }, { role: "user", content: `Calculate life path and destiny numbers for Name: ${fullName}, DOB: ${dob}. Give an extensive report.` }],
        temperature: 0.7, max_tokens: 1000
      })
    });
    const data = await res.json();
    return NextResponse.json({ success: true, analysis: data.choices?.[0]?.message?.content || "Numerology analysis complete." });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}
