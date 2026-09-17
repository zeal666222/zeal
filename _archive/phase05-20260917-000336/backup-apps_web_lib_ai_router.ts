import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "missing-key",
});

export async function generateFaultTolerantStream(systemPrompt: string, userPrompt: string) {
  try {
    if (process.env.AGNES_API_KEY) {
      const agnesResponse = await fetch("https://api.agnes.ai/v1/stream", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.AGNES_API_KEY}` },
        body: JSON.stringify({ prompt: userPrompt, system: systemPrompt })
      });
      
      if (agnesResponse.ok) {
        return agnesResponse;
      }
    }
  } catch (error) {
    console.warn("[AI ROUTER] Agnes AI failed. Falling back to Groq.");
  }

  const result = await streamText({
    model: groq("llama3-8b-8192"),
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
