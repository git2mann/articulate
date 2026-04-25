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

    // 1. Try Groq Vision (Faster, better rate limits)
    if (GROQ_API_KEY) {
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts && !data) {
        try {
          console.log(`[Groq Vision] Indexing "${album_name}" (Attempt ${attempts + 1})...`);
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
            const errJson = await groqResp.json();
            // Wait the requested time + a small buffer
            const waitMs = (parseFloat(errJson.error?.message?.match(/(\d+\.?\d*)s/)?.[1] || "1") * 1000) + 500;
            console.warn(`[Groq 429] Rate limit hit. Waiting ${waitMs}ms...`);
            await new Promise(r => setTimeout(r, waitMs));
            attempts++;
          } else {
            const errText = await groqResp.text();
            console.warn(`[Groq Vision Error] ${errText}`);
            break; 
          }
        } catch (e: any) {
          console.warn(`[Groq Vision failed] ${e.message}.`);
          attempts++;
        }
      }
    }

    // 2. Fallback to Gemini
    if (!data && GEMINI_API_KEY) {
      if (global.geminiQuotaExceededUntil && Date.now() < global.geminiQuotaExceededUntil) {
        console.log(`[Gemini Vision] Skipping fallback indexing for "${album_name}" due to active quota block.`);
      } else {
        try {
          console.log(`[Gemini Vision] Indexing "${album_name}" as fallback...`);
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
          });

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
          ]);
          
          const text = result.response.text();
          const cleanJson = text.replace(/```json|```/g, "").trim();
          data = JSON.parse(cleanJson);
        } catch (e: any) {
          if (e.message?.includes("429") || e.message?.includes("quota")) {
            console.warn(`[Gemini Quota] Detected limit in Indexing. Blocking for 60s.`);
            (global as any).geminiQuotaExceededUntil = Date.now() + 60000;
          }
          console.warn(`[Gemini Vision failed] ${e.message}`);
        }
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
