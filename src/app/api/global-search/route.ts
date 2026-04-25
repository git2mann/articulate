import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { searchSpotifyAlbum, getSpotifyServiceToken } from "@/lib/spotify";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { query, action, history, candidates, libraryContext } = await req.json();
    console.log(`[Search] Action: ${action || 'initial'}, Query: "${query}"`);

    const session: any = await getServerSession(authOptions);
    let accessToken = session?.accessToken;

    // FALLBACK: If user is not logged in, use a Service Token to fetch covers
    if (!accessToken) {
      console.log("[Search] No user session. Fetching service token for cover art...");
      accessToken = await getSpotifyServiceToken();
    }

    const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GEMINI_API_KEY) console.warn("[Search] Missing Gemini API Key");
    if (!GROQ_API_KEY) console.warn("[Search] Missing Groq API Key");

    let data;

    const tryGemini = async (modelName: string) => {
      if (global.geminiQuotaExceededUntil && Date.now() < global.geminiQuotaExceededUntil) {
        console.log(`[Gemini] Skipping ${modelName} due to active quota block.`);
        return null;
      }

      console.log(`[Gemini] Sending request to ${modelName}...`);
      const start = Date.now();
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      let systemPrompt = "";
      let userPrompt = "";

      if (action === 'refine') {
        systemPrompt = `You are a visual album retrieval expert. Update the list of candidate albums based on the user's latest answer.
Return JSON: { "action": "update" | "search_refresh" | "finalize", "updatedCandidates": AlbumCandidate[], "nextQuestion": "string" }
AlbumCandidate: { "title": "string", "artist": "string", "visualDescription": "string", "confidence": number }

${libraryContext ? `FAVORITE ALBUMS (The Ground Truth):
${JSON.stringify(libraryContext)}
Prioritize matching against these if they fit the clues.` : ''}

DECISIVENESS: Be decisive. If you have 1-3 highly likely candidates, or if further questioning will not significantly narrow the scope, set 'action' to 'finalize'.
FLEXIBILITY: You can prune irrelevant albums AND add new albums that better match the updated visual description. 
STRICT VISUAL CONSTRAINT: Ignore titles. Focus on visual descriptions.
CRITICAL: Every item in 'updatedCandidates' MUST be a complete AlbumCandidate object with a 'visualDescription'.`;
        userPrompt = `Original Visual Query: "${query}"
History: ${JSON.stringify(history)}
Current Candidate Visuals: ${JSON.stringify(candidates.map((c: any) => ({ title: c.title, artist: c.artist, actual_cover_content: c.visualDescription })))}
Latest Visual Detail: "${history[history.length - 1].a}"
Based on the Latest Visual Detail, provide an updated list. If confident, set action to 'finalize'.`;
      } else {
        if (libraryContext) {
          systemPrompt = `You are a personal visual discography expert. 
Your goal is to find the closest matches from the user's FAVORITE ALBUMS based on their visual description.
Return JSON: { "candidates": AlbumCandidate[], "discriminatorQuestion": "string" }

FAVORITE ALBUMS (The Ground Truth):
${JSON.stringify(libraryContext)}

CRITICAL:
1. You MUST prioritize matching the user's query against the 'visualDescription' of the FAVORITE ALBUMS provided.
2. If a Favorite Album matches, return it exactly as it appears in the list.
3. If no Favorite Album matches well, you may suggest one real-world album that matches perfectly.`;
        } else {
          systemPrompt = `You are a visual album retrieval expert. Find 5 REAL albums that match the visual description provided.
Return JSON: { "candidates": AlbumCandidate[], "discriminatorQuestion": "string" }
AlbumCandidate: { "title": "string", "artist": "string", "year": "string", "visualDescription": "string", "confidence": number }

ANTI-KEYWORD BIAS: Match the ARTWORK, not the title.
CRITICAL: Every item in 'candidates' MUST be a complete AlbumCandidate object with a 'visualDescription'.`;
        }
        userPrompt = `Visual Description of Artwork: ${query}`;
      }

      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: systemPrompt,
        });

        const response = result.response;
        const parsed = JSON.parse(response.text());
        console.log(`[Gemini] Received response from ${modelName} in ${Date.now() - start}ms`);
        return parsed;
      } catch (e: any) {
        if (e.message?.includes("429") || e.message?.includes("quota")) {
          console.warn(`[Gemini Quota] Detected 429/Quota limit for ${modelName}. Blocking Gemini for 60s.`);
          // Set a global flag to skip Gemini for a minute
          (global as any).geminiQuotaExceededUntil = Date.now() + 60000;
        }
        throw e;
      }
    };

    const tryGroq = async () => {
      console.log(`[Groq] Sending request to llama-3.3-70b-versatile...`);
      const start = Date.now();
      
      let systemPrompt = "";
      let userPrompt = "";

      if (action === 'refine') {
        systemPrompt = `You are a visual album retrieval expert. Update the list of candidate albums based on the user's latest answer. Return ONLY JSON.
Return JSON format: { "action": "update" | "search_refresh" | "finalize", "updatedCandidates": AlbumCandidate[], "nextQuestion": "string" }
AlbumCandidate: { "title": "string", "artist": "string", "visualDescription": "string", "confidence": number }

${libraryContext ? `FAVORITE ALBUMS: ${JSON.stringify(libraryContext)}. Prioritize these.` : ''}

DECISIVENESS: If you have 1-3 likely candidates, or if further questions won't help, set 'action' to 'finalize'.
FLEXIBILITY: You can prune irrelevant albums AND add new albums that better match the updated visual description.`;
        userPrompt = `Original Visual Query: "${query}", History: ${JSON.stringify(history)}, Current Candidate Visuals: ${JSON.stringify(candidates.map((c: any) => ({ title: c.title, artist: c.artist, actual_cover_content: c.visualDescription })))} , Latest Visual Detail: "${history[history.length - 1].a}". If confident, finalize.`;
      } else {
        if (libraryContext) {
          systemPrompt = `You are a personal visual discography expert. Match user query against FAVORITE ALBUMS: ${JSON.stringify(libraryContext)}. Return JSON: { "candidates": [], "discriminatorQuestion": "string" }`;
        } else {
          systemPrompt = `You are a visual album retrieval expert. Find 5 REAL albums matching VISUAL description. Return ONLY JSON.
Return JSON format: { "candidates": AlbumCandidate[], "discriminatorQuestion": "string" }
AlbumCandidate: { "title": "string", "artist": "string", "year": "string", "visualDescription": "string", "confidence": number }
ANTI-KEYWORD BIAS: Match the ARTWORK. Every item in 'candidates' MUST be a complete object with a 'visualDescription'.`;
        }
        userPrompt = `Visual Description of Artwork: ${query}`;
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Groq Error Details] ${errorText}`);
        throw new Error(`Groq status: ${response.status}`);
      }
      const result = await response.json();
      const parsed = JSON.parse(result.choices[0].message.content);
      console.log(`[Groq] Received response in ${Date.now() - start}ms`);
      return parsed;
    };

    // Layered Fallback Strategy
    if (GEMINI_API_KEY) {
      try {
        data = await tryGemini("gemini-2.0-flash");
      } catch (e: any) {
        console.warn(`[Gemini 2.0 Error] ${e.message}`);
      }
    }

    if (!data && GROQ_API_KEY) {
      try {
        data = await tryGroq();
      } catch (e: any) {
        console.warn(`[Groq Error] ${e.message}`);
      }
    }

    if (!data && GEMINI_API_KEY) {
      try {
        // Using common alias for 1.5 Flash
        data = await tryGemini("gemini-1.5-flash");
      } catch (e: any) {
        console.warn(`[Gemini 1.5 Error] ${e.message}`);
      }
    }

    if (!data) {
      // Fallback to Ollama
      const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
      const MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

      let systemPrompt = "";
      let userPrompt = "";

      if (action === 'refine') {
        systemPrompt = `You are a visual album retrieval expert. Update candidates based on visual clues. 
Return JSON: { "action": "update" | "search_refresh" | "finalize", "updatedCandidates": AlbumCandidate[], "nextQuestion": "Brief visual question" }
DECISIVENESS: If you have 1-3 likely candidates, set 'action' to 'finalize'.
FLEXIBILITY: You can prune irrelevant albums AND add new albums that better match the updated visual description.`;
        userPrompt = `Original Visual Query: "${query}", History: ${JSON.stringify(history)}, Candidates: ${JSON.stringify(candidates.map((c: any) => ({ title: c.title, artist: c.artist, actual_cover_content: c.visualDescription })))} , Latest Visual: "${history[history.length - 1].a}". If confident, finalize.`;
      } else {
        systemPrompt = `Find 5 REAL albums matching VISUAL description: "${query}". 
Return JSON: { "candidates": AlbumCandidate[], "discriminatorQuestion": "Visual question" }
AlbumCandidate: { "title": "string", "artist": "string", "visualDescription": "string", "confidence": number }
ANTI-KEYWORD BIAS: Match the ARTWORK. Every item MUST be a complete object with a 'visualDescription'.`;
        userPrompt = `Visual Description: ${query}`;
      }

      console.log(`[Ollama] Sending request to ${MODEL}...`);
      const start = Date.now();
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: userPrompt,
          system: systemPrompt,
          stream: false,
          format: "json",
          options: { 
            temperature: 0.1, 
            num_predict: 512, 
            num_ctx: 4096 
          } 
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama status: ${response.status}`);
      }

      const result = await response.json();
      data = JSON.parse(result.response);
      data.isFallback = true;
      console.log(`[Ollama] Received response in ${Date.now() - start}ms`);
    }

    // Robustness: ensure candidates or updatedCandidates are arrays
    if (action === 'refine') {
      if (!Array.isArray(data.updatedCandidates)) {
        data.updatedCandidates = [];
      }
    } else {
      if (!Array.isArray(data.candidates)) {
        data.candidates = [];
      }
    }

    // AUGMENTATION: If we have an accessToken, fetch real metadata for the candidates
    if (accessToken) {
      const candidatesToFetch = action === 'refine' ? data.updatedCandidates : data.candidates;
      if (candidatesToFetch && candidatesToFetch.length > 0) {
        const augmented = await Promise.all(candidatesToFetch.map(async (c: any) => {
           if (c.title && c.artist) {
              const spotifyAlbum = await searchSpotifyAlbum(c.title, c.artist, accessToken);
              if (spotifyAlbum) {
                 return {
                    ...c,
                    image_url: spotifyAlbum.images[0]?.url,
                    spotify_url: spotifyAlbum.external_urls.spotify,
                    spotify_uri: spotifyAlbum.uri,
                    title: spotifyAlbum.name,
                    artist: spotifyAlbum.artists[0]?.name
                 };
              }           }
           return c;
        }));

        if (action === 'refine') {
          data.updatedCandidates = augmented;
        } else {
          data.candidates = augmented;
        }
      }
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Search Error]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
