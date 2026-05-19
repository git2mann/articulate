import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

/**
 * INDEXING PIPELINE (Section 6)
 * Vision Analysis via Groq (Primary) or Gemini (Fallback)
 */
export async function POST(req: Request) {
  let album_name = "Unknown Album";
  try {
    const body = await req.json();
    album_name = body.album_name;
    const { image_url } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const imageResp = await fetch(image_url);
    if (!imageResp.ok) throw new Error(`Image fetch failed: ${imageResp.statusText}`);
    const imageBuffer = await imageResp.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const prompt = `
      Analyze this album cover for the album "${album_name}" and return structured JSON with exactly these fields:
      - colors (array of strings)
      - brightness (string: "dark" or "bright")
      - style (string: "photograph", "illustration", or "abstract")
      - objects (array of strings)
      - composition (string: "centered", "scattered", or "portrait")
      - mood (string: one word)
      - description (string: a detailed visual description for semantic search)

      Return ONLY valid JSON. No other text.
    `;

    let data;

    // 1. Groq Vision (Primary Remote) with strict rate limiting
    if (GROQ_API_KEY) {
      if (!(global as any).groqVisionTimestamps) (global as any).groqVisionTimestamps = [];
      const now = Date.now();
      (global as any).groqVisionTimestamps = (global as any).groqVisionTimestamps.filter((t: number) => now - t < 60000);
      
      if ((global as any).groqVisionTimestamps.length < 30 && !(global as any).groqVisionBlockedUntil || now > (global as any).groqVisionBlockedUntil) {
        try {
          (global as any).groqVisionTimestamps.push(now);
          console.log(`[Groq Vision] Indexing "${album_name}" ...`);
          const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "meta-llama/llama-4-scout-17b-16e-instruct",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    {
                      type: "image_url",
                      image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                    }
                  ]
                }
              ],
              response_format: { type: "json_object" },
              temperature: 0.1
            })
          });

          if (groqResp.ok) {
            const groqData = await groqResp.json();
            data = JSON.parse(groqData.choices[0].message.content);
            console.log(`[Groq Vision] Success indexing "${album_name}"`);
          } else if (groqResp.status === 429) {
            (global as any).groqVisionBlockedUntil = Date.now() + 60000;
            console.warn(`[Groq 429] Rate limit hit. Blocking Groq Vision for 60s.`);
          }
        } catch (e: any) {
          console.warn(`[Groq Vision failed] ${e.message}.`);
        }
      }
    }

    // 2. Ollama Vision (High-Performance Local Fallback)
    // Runs on your M1 Pro using Llama-3-Vision or Moondream
    if (!data) {
      try {
        const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
        const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llava";

        console.log(`[Ollama Vision] Attempting local inference for "${album_name}" ...`);
        const ollamaResp = await fetch(OLLAMA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt: prompt,
            images: [base64Image],
            stream: false,
            format: "json"
          })
        });

        if (ollamaResp.ok) {
          const ollamaData = await ollamaResp.json();
          // Extract JSON if the model includes reasoning or markers
          const rawResponse = ollamaData.response;
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          data = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
          console.log(`[Ollama Vision] Success indexing "${album_name}"`);
        }
      } catch (e: any) {
        console.warn(`[Ollama Vision failed] Ensure Ollama is running locally with ${process.env.OLLAMA_MODEL || 'llama3-vision'}.`);
      }
    }

    if (!data) throw new Error("All vision providers failed.");

    return NextResponse.json({
      tags: {
        colors: data.colors || [],
        brightness: data.brightness || 'bright',
        style: data.style || 'photograph',
        objects: data.objects || [],
        composition: data.composition || 'centered',
        mood: data.mood || 'unknown'
      },
      description: data.description || `Album artwork for ${album_name}`
    });
  } catch (error: any) {
    console.error(`Indexing Error for "${album_name}":`, error.message);
    return NextResponse.json({ error: error.message, album: album_name }, { status: 500 });
  }
}
