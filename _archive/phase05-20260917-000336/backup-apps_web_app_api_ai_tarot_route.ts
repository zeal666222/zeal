import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { cards } = await request.json(); // Array of 3 card names

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({
        success: true,
        reading: `Your 3-card spread (${cards.join(', ')}) reveals a powerful transition from past reflections into present empowerment. The future card indicates alignment and clarity in upcoming endeavors.`
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
            content: "You are an esoteric Arcane Tarot reader skilled in Rider-Waite symbolism, temporal spreads (Past, Present, Future), and psychological archetypes."
          },
          {
            role: "user",
            content: `Provide a profound 3-card Tarot reading for these drawn cards:\n1. Past: ${cards[0]}\n2. Present: ${cards[1]}\n3. Future: ${cards[2]}\n\nSynthesize their combined energetic resonance.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const reading = data.choices?.[0]?.message?.content || "Tarot synthesis complete.";

    return NextResponse.json({ success: true, reading });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
