import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, dob, tob, pob } = await request.json();

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      // Fallback deterministic reading if API key isn't set yet
      return NextResponse.json({
        success: true,
        analysis: `Janam Kundali generated for ${name} born on ${dob} at ${tob} in ${pob}. Ascendant is in Aries with strong Mars placement in the 10th house indicating career prominence. Jupiter in the 5th house brings wisdom and auspicious educational prospects. Vimshottari Dasha is currently running under Mercury Mahadasha.`
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an expert Vedic astrologer (Jyotishi) with profound mastery over Janam Kundali, planetary houses, nakshatras, and Vimshottari Dashas. Provide professional, deeply insightful, and structured astrological reports."
          },
          {
            role: "user",
            content: `Generate a detailed Vedic Janam Kundali analysis for:\nName: ${name}\nDate of Birth: ${dob}\nTime of Birth: ${tob}\nPlace of Birth: ${pob}\n\nInclude Lagna (Ascendant), core planetary strengths, house placements, and current Dasha overview.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Kundali computation completed.";

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
