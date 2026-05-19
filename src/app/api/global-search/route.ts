import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { searchSpotifyAlbum, getSpotifyServiceToken } from "@/lib/spotify";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { query, action, history, candidates, libraryContext } = await req.json();
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[Search:${requestId}] --- New Request ---`);
    console.log(`[Search:${requestId}] Action: ${action || 'initial'}`);
    console.log(`[Search:${requestId}] Query: "${query}"`);
    if (libraryContext) console.log(`[Search:${requestId}] Context: Local Library active (${libraryContext.length} albums)`);
    if (history) console.log(`[Search:${requestId}] History: ${history.length} cycles`);

    const session: any = await getServerSession(authOptions);
    let accessToken = session?.accessToken;

    if (!accessToken) {
      console.log(`[Search:${requestId}] Auth: No session. Using service token fallback.`);
      accessToken = await getSpotifyServiceToken();
    } else {
      console.log(`[Search:${requestId}] Auth: User session active.`);
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) console.warn("[Search] Missing Groq API Key");

    let data;

    const tryGemini = async (modelName: string) => {
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) return null;
      
      const genAI = new GoogleGenerativeAI(apiKey);
      
      if (global.geminiQuotaExceededUntil && Date.now() < global.geminiQuotaExceededUntil) {
        console.log(`[Gemini] Skipping ${modelName} due to active quota block.`);
        return null;
      }

      console.log(`[Gemini] Sending request to ${modelName}...`);
      const start = Date.now();
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      let systemPrompt = "";
      let userPrompt = "";

      if (action === 'refine') {
        systemPrompt = `You are a visual retrieval expert. Compare the current candidates and find a VISUAL difference between them.
Return ONLY JSON: { "isComplete": boolean, "results": AlbumCandidate[], "question": "string" }
AlbumCandidate: { "id": "string", "title": "string", "artist": "string", "visualDescription": "string", "confidence": number }

${libraryContext ? `GROUND TRUTH: ${JSON.stringify(libraryContext)}` : ''}

GOAL: Ask a short, human-like question about a visual detail (color, object position, style) that would eliminate some candidates.
DECISIVENESS: If you have 1-3 likely candidates, prioritize finalizing quickly. Limit total refinement steps to 3 max. If confidence is >80%, set 'isComplete' to true.
If only 1 candidate remains or they are visually identical, set 'isComplete' to true.`;
        userPrompt = `Search: "${query}". History: ${JSON.stringify(history)}. Candidates: ${JSON.stringify(candidates.map((c: any) => ({ title: c.title, visual: c.visualDescription })))}. 
Based on the history, provide an updated result list and a new discriminator question.`;
      } else {
        systemPrompt = `You are a visual discography expert. Match the user's memory against the FAVORITE ALBUMS provided.
Return ONLY JSON: { "results": AlbumCandidate[], "question": "string" }
AlbumCandidate: { "id": "string", "title": "string", "artist": "string", "visualDescription": "string", "confidence": number }

FAVORITE ALBUMS (The Ground Truth):
${JSON.stringify(libraryContext)}

LOGIC:
1. Identify albums in the list that match the visual description.
2. If multiple matches exist, look at their 'visualDescription' and find a difference.
3. Ask a brief question to tell them apart (e.g. "Is the background blue or red?").
4. If no good matches in the list, search your broader knowledge for real-world albums.
CRITICAL: Do NOT just repeat the user's query as the question. Ask a new question.`;
        userPrompt = `Memory: "${query}"`;
      }

      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: systemPrompt,
        });

        const response = result.response;
        const rawText = response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        console.log(`[Gemini] Received response from ${modelName} in ${Date.now() - start}ms`);
        return parsed;
      } catch (e: any) {
        if (e.message?.includes("429") || e.message?.includes("quota")) {
          console.warn(`[Gemini Quota] Detected 429/Quota limit for ${modelName}. Blocking Gemini for 60s.`);
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
        systemPrompt = `You are a visual retrieval expert. Compare candidates and ask a targeted visual question to narrow the search.
Return ONLY JSON: { "isComplete": boolean, "results": AlbumCandidate[], "question": "string" }
${libraryContext ? `FAVORITE ALBUMS: ${JSON.stringify(libraryContext)}` : ''}

INSTRUCTIONS:
1. Ask about a visual detail that differs between the candidates (e.g. "Does it have text on it?", "Is there a person on the cover?").
2. Be brief and conversational.
3. If only one likely match remains, set isComplete: true.`;
        userPrompt = `Query: "${query}", History: ${JSON.stringify(history)}, Candidates: ${JSON.stringify(candidates.map((c: any) => ({ title: c.title, visual: c.visualDescription })))}. 
Analyze the history and candidates, then provide updated 'results' and a new discriminator 'question'.`;
      } else {
        if (libraryContext) {
          systemPrompt = `You are a visual discography expert. Match the query against these FAVORITE ALBUMS: ${JSON.stringify(libraryContext)}.
Return ONLY JSON: { "results": AlbumCandidate[], "question": "string" }

INSTRUCTIONS:
1. Find matches in the list based on visual content.
2. If more than 1 match, ask a visual question to tell them apart. 
3. DO NOT repeat the query. Ask something NEW.
4. Each result MUST have the 'id' from the library list.`;
        } else {
          systemPrompt = `Find 5 real albums matching this visual description. Return ONLY JSON: { "results": AlbumCandidate[], "question": "string" }`;
        }
        userPrompt = `Memory: "${query}"`;
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
          temperature: 0.2
        })
      });

      if (!response.ok) throw new Error(`Groq status: ${response.status}`);
      const result = await response.json();
      const parsed = JSON.parse(result.choices[0].message.content);
      console.log(`[Groq] Received response in ${Date.now() - start}ms`);
      return parsed;
    };

    if (GROQ_API_KEY) {
      try {
        data = await tryGroq();
      } catch (e: any) {
        console.warn(`[Groq Error] ${e.message}`);
      }
    }

    if (!data) {
      const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
      const MODEL = process.env.OLLAMA_MODEL || "llama3";
      
      let systemPrompt = `You are a visual album expert. Return ONLY JSON: { "results": AlbumCandidate[], "question": "string", "isComplete": boolean }`;
      let userPrompt = `Visual Description: ${query}. Find matches.`;
      
      if (libraryContext) systemPrompt += ` FAVORITE ALBUMS: ${JSON.stringify(libraryContext)}`;

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
          format: "json"
        })
      });

      if (response.ok) {
        const result = await response.json();
        data = JSON.parse(result.response);
        console.log(`[Ollama] Received response in ${Date.now() - start}ms`);
      }
    }

    if (!data) throw new Error("No data from providers");

    // Standardize data format (Frontend expects 'results' and 'question')
    if (!data.results) data.results = data.candidates || data.updatedCandidates || [];
    if (!data.question) data.question = data.discriminatorQuestion || data.nextQuestion || "";

    // AUGMENTATION: If we have an accessToken, fetch real metadata
    if (accessToken && data.results.length > 0) {
      console.log(`[Search:${requestId}] Spotify: Augmenting ${data.results.length} candidates...`);
      data.results = await Promise.all(data.results.map(async (c: any) => {
        // First check if it's already in the libraryContext (local match)
        const localMatch = libraryContext?.find((l: any) => l.id === c.id || (l.title === c.title && l.artist === c.artist));
        if (localMatch) return { ...c, ...localMatch, image_url: localMatch.image_url || c.image_url };

        // Otherwise search Spotify
        if (c.title && c.artist) {
          const spotifyAlbum = await searchSpotifyAlbum(c.title, c.artist, accessToken);
          if (spotifyAlbum) {
            return {
              ...c,
              image_url: spotifyAlbum.images[0]?.url,
              spotify_url: spotifyAlbum.external_urls.spotify,
              spotify_uri: spotifyAlbum.uri,
              title: spotifyAlbum.name,
              artist: spotifyAlbum.artists[0]?.name,
              id: spotifyAlbum.id
            };
          }
        }
        return c;
      }));
    }
    
    console.log(`[Search:${requestId}] --- Request Complete ---`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Search Error] Critical Failure: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
