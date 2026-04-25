# Articulate 🎨 🎵

**Articulate** is an AI-powered "visual detective" for your music library. It solves a specific, real-world problem: remembering a song or album by its artwork but forgetting its name. Instead of manually scrolling through thousands of tracks, Articulate allows you to search your Spotify library using natural language descriptions of the cover art.

## 🌟 The Problem
Traditional music search engines are built for **textual facts** (Artist, Album, Title). However, many listeners (including myself) have a **visual memory**. When we think of a song, we see the colors, the mood, and the imagery of the cover art. Without the artist's name, that song is effectively "lost" in a library of thousands of liked tracks, forced into a tedious manual scroll.

## 🚀 The Solution
Articulate bridges the "semantic gap" between visual memory and digital data.
- **Personal Visual Index:** Connects to your Spotify and creates a "Neural Fingerprint" for each of your liked albums.
- **Natural Language Search:** Describe what you remember (e.g., *"A blue neon city with rain"*) and the AI finds the match.
- **Refinement Engine:** If the search is broad, the app uses a "Twenty Questions" logic to ask visual follow-up questions (e.g., *"Was it a photograph or an illustration?"*) to narrow down the results.

## 🛠️ How it Works (The AI Stack)
- **Vision (The Eyes):** Uses **Groq (Llama-3 Vision)** or **Gemini 2.0 Flash** to analyze and describe album covers in structured JSON (colors, objects, composition, mood).
- **Embeddings (The Brain):** Uses **Transformers.js** to run neural models (`all-MiniLM-L6-v2`) **locally in your browser**. This converts your text into vectors for instant semantic matching.
- **Vector Search:** Calculates **Cosine Similarity** between your description and your library's "Neural Fingerprints" to rank candidates.
- **Local-First:** All search and vector comparison logic happens on your device, ensuring privacy and speed.

## 📋 Prerequisites
To get Articulate running, you will need the following API keys:
1.  **Spotify Developer Account:** To access your library and play music.
2.  **Groq API Key (Optional but Recommended):** For ultra-fast visual analysis.
3.  **Google AI (Gemini) API Key:** As a robust fallback for vision tasks.

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/articulate.git
cd articulate
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory and add your credentials:
```env
# Spotify Integration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXTAUTH_SECRET=a_random_string_for_auth
NEXTAUTH_URL=http://localhost:3000

# AI Vision Providers
GROQ_API_KEY=your_groq_api_key
GOOGLE_AI_API_KEY=your_gemini_api_key
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 How to Use
1.  **Connect Spotify:** Click "Connect Spotify" to authorize the app.
2.  **Sync Favorites:** Click "Sync Favorites." The app will begin "Neural Mapping" your library. *Note: The first sync can take a few minutes due to AI analysis limits.*
3.  **Search:** Once indexed, type a description into the main bar.
4.  **Refine:** Answer any follow-up questions from the AI to zero in on your track.
5.  **Listen:** Click "Open in Player" to jump straight to the song on Spotify.

## 🧪 Technical Reflection
- **What’s Hard:** Translating subjective "vibes" into mathematical vectors.
- **Current Limitation:** Initial indexing speed is bottlenecked by API rate limits for image analysis.
- **Next Steps:** Implementing **CLIP** (Contrastive Language-Image Pre-training) to allow direct text-to-image feature matching for even more abstract searches.

---
Created as a "Small, Real AI Solution" prototype.
