"use client";

import React, { useState, useEffect } from 'react';
// Simple notification component
function Notification({ message, onClose }: { message: string, onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
      <span className="font-bold text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white font-black">×</button>
    </div>
  );
}
import { useSession, signIn, signOut } from "next-auth/react";
import { 
  Search, Music, RotateCcw, ChevronRight, CheckCircle2, 
  Loader2, Sparkles, Globe, Zap, X, Play, ExternalLink, 
  Image as ImageIcon, MessageCircle, AlertCircle, ArrowLeft,
  LogIn, LogOut
} from 'lucide-react';

import { AlbumCandidate, SessionWithToken } from '@/types';
import { getEmbedding, computeCosineSimilarity } from '@/lib/embeddings';

export default function App() {
  const [notification, setNotification] = useState<string>("");
  const { data: session } = useSession() as { data: SessionWithToken | null };
  const [view, setView] = useState('landing'); // landing, identifying, questioning, result
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<AlbumCandidate[]>([]);
  const [localMatches, setLocalMatches] = useState<any[]>([]);
  const [library, setLibrary] = useState<AlbumCandidate[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<{q: string, a: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load local library if exists
    const saved = localStorage.getItem('cover_recall_library');
    if (saved) setLibrary(JSON.parse(saved));
  }, []);

  // Helper to show a notification for 5s
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 5000);
  };

  const syncLibrary = async () => {
    if (!session?.accessToken) {
      signIn('spotify');
      return;
    }
    
    setIsSyncing(true);
    setSyncProgress(0);
    setError(null);

    try {
      const songsResp = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (songsResp.status === 429) {
        showNotification('Spotify API quota exceeded. Please try again later.');
        setIsSyncing(false);
        return;
      }
      const songsData = await songsResp.json();
      
      const newLibrary: AlbumCandidate[] = [];
      const total = songsData.items.length;

      for (let i = 0; i < total; i++) {

        const item = songsData.items[i];
        const album = item.track.album;
        const track = item.track;

        // Avoid duplicate indexing within the same batch or if already in library
        const isDuplicateBatch = newLibrary.some(libItem => libItem.id === album.id);
        const existing = library.find(libItem => libItem.id === album.id);

        if (isDuplicateBatch || existing) {
          if (existing && !isDuplicateBatch) {
            newLibrary.push(existing);
          }
          setSyncProgress(Math.round(((i + 1) / total) * 100));
          continue;
        }

        try {
          // 1. Visual Analysis (Groq/Gemini)
          const indexResp = await fetch('/api/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              album_name: album.name,
              image_url: album.images[0]?.url
            })
          });
          const indexData = await indexResp.json();
          if (!indexData.description || typeof indexData.description !== 'string' || indexData.description.trim().length === 0) {
            console.warn('Skipping album with missing description:', album.name, album.id);
            setSyncProgress(Math.round(((i + 1) / total) * 100));
            continue;
          }

          // 2. Local Neural Fingerprinting (Xenova)
          const desc = indexData.description;
          if (!desc || typeof desc !== 'string' || desc.trim().length === 0) {
            console.warn('Skipping embedding for album with invalid description:', album.name, album.id);
            setSyncProgress(Math.round(((i + 1) / total) * 100));
            continue;
          }
          const embedding = await getEmbedding(desc);

          newLibrary.push({
            id: album.id,
            title: album.name,
            artist: album.artists[0].name,
            image_url: album.images[0].url,
            spotify_url: album.external_urls.spotify,
            spotify_uri: track.uri || album.uri,
            visualDescription: desc,
            embedding: embedding, // Stored for vector search
            tags: indexData.tags,
            confidence: 1 // Default to 1 for synced albums
          });
        } catch (e) { console.error(e); }
        
        setSyncProgress(Math.round(((i + 1) / total) * 100));
        
        // RATE LIMIT PROTECTION
        await new Promise(res => setTimeout(res, 6000));
      }

      // Merge new results with old library (keeping old ones that weren't in this sync too)
      const mergedLibrary = [...newLibrary];
      for (const oldItem of library) {
        if (!mergedLibrary.some(newItem => newItem.id === oldItem.id)) {
          mergedLibrary.push(oldItem);
        }
      }

      setLibrary(mergedLibrary);
      localStorage.setItem('cover_recall_library', JSON.stringify(mergedLibrary));
    } catch (err) {
      console.error(err);
      setError("Library sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const findLocalMatches = async (userQuery: string) => {
    if (library.length === 0) return;
    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
      console.warn('[Neural Engine] findLocalMatches called with invalid or empty userQuery:', userQuery);
      return;
    }
    try {
      const queryEmbedding = await getEmbedding(userQuery);
      if (!queryEmbedding || queryEmbedding.length === 0) return;

      // Only score items with valid embeddings
      const scored = library
        .filter(item => Array.isArray(item.embedding) && item.embedding.length > 0)
        .map(item => ({
          ...item,
          similarity: computeCosineSimilarity(queryEmbedding, item.embedding as number[])
        }));

      // Sort by similarity and take top 4
      const matches = scored
        .filter(s => s.similarity > 0.4) // Minimum threshold for relevance
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 4);

      setLocalMatches(matches);
    } catch (e) {
      console.error("Local Neural Match Error:", e);
    }
  };

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 5) => {
    setUsingFallback(false);
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 300000);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        if (response.ok) return await response.json();
        if (response.status !== 429 && i === retries - 1) throw new Error('Search failed');
      } catch (err: any) {
        clearTimeout(id);
        if (i === retries - 1) throw err;
      }
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
    throw new Error("Overloaded.");
  };

  const handleInitialIdentify = async (overrideQuery = null) => {
    const activeQuery = overrideQuery || query;
    if (!activeQuery.trim()) return;
    setIsProcessing(true);
    setView('identifying');
    setError(null);
    setLocalMatches([]);

    // Instant local neural match
    findLocalMatches(activeQuery);

    try {
      const data = await fetchWithRetry('/api/global-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: activeQuery, 
          action: 'initial',
          libraryContext: library.length > 0 ? library.map(l => ({
            title: l.title,
            artist: l.artist,
            visualDescription: l.visualDescription
          })) : null
        })
      });

      if (data.isFallback) {
        setUsingFallback(true);
        showNotification('API quota exceeded. Using local fallback mode. Results may be slower or less accurate.');
      }
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setCurrentQuestion(data.discriminatorQuestion);
      setView('questioning');
    } catch (err: any) {
      setError("Visual retrieval failed.");
      showNotification('Visual retrieval failed. Please try again or check your connection.');
      setView('landing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    setIsProcessing(true);
    const newHistory = [...history, { q: currentQuestion, a: answer }];
    setHistory(newHistory);

    try {
      const data = await fetchWithRetry('/api/global-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, action: 'refine', history: newHistory, candidates })
      });

      if (data.isFallback) setUsingFallback(true);

      if (data.action === "search_refresh") {
        handleInitialIdentify(data.newSearchTerms);
      } else {
        const nextCands = Array.isArray(data.updatedCandidates) ? data.updatedCandidates : candidates;
        setCandidates(nextCands);
        if (data.action === "finalize" || nextCands.length === 1) {
          setView('result');
        } else {
          setCurrentQuestion(data.nextQuestion);
        }
      }
    } catch (err) {
      setView('result');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCandidate = (candidate: AlbumCandidate) => {
    setCandidates([candidate]);
    setView('result');
  };

  const reset = () => {
    setView('landing');
    setQuery('');
    setCandidates([]);
    setHistory([]);
    setCurrentQuestion('');
    setError(null);
  };

  if (!mounted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] animate-pulse">
        <div className="w-16 h-16 bg-white/5 rounded-3xl mb-8 flex items-center justify-center border border-white/10">
          <ImageIcon className="w-8 h-8 text-white/20" />
        </div>
        <div className="text-white/20 font-black tracking-[0.5em] text-[10px]">NEURAL ENGINE INITIALIZING...</div>
      </div>
    );
  }

  return (
    <>
      <Notification message={notification} onClose={() => setNotification("")} />
      <div className="min-h-screen text-neutral-100 font-sans selection:bg-emerald-500/30 flex flex-col overflow-x-hidden">
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full flex-1 flex flex-col">
        
        <nav className="flex justify-between items-center py-8 mt-4 px-6 liquid-glass">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
            <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-3 transition-transform">
              <ImageIcon className="w-6 h-6 text-black" />
            </div>
            <div>
              <span className="block text-xl font-black tracking-tighter leading-none text-white">Articulate</span>
              <span className="text-[9px] font-bold text-emerald-500 tracking-[0.2em] uppercase flex items-center gap-1">
                <Globe className="w-2 h-2" /> Neural Mapping v3
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {session && (
              <button 
                onClick={syncLibrary}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-4 py-2 ${isSyncing ? 'bg-white/5 text-neutral-500' : 'bg-white/5 text-neutral-400 hover:bg-white/10'} rounded-xl text-xs font-bold transition-all border border-white/5 backdrop-blur-md`}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> {syncProgress}%
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" /> Sync Favorites
                  </>
                )}
              </button>
            )}
            {session ? (
              <button 
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-neutral-400 transition-all border border-white/5 backdrop-blur-md"
              >
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            ) : (
              <button 
                onClick={() => signIn('spotify')}
                className="flex items-center gap-2 px-4 py-2 bg-[#1DB954] hover:bg-[#1ed760] rounded-xl text-xs font-black text-black transition-all shadow-lg shadow-emerald-500/20"
              >
                <LogIn className="w-3 h-3" /> Connect Spotify
              </button>
            )}
            {view !== 'landing' && (
              <button onClick={reset} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5 backdrop-blur-md">
                <RotateCcw className="w-4 h-4 text-neutral-400" />
              </button>
            )}
          </div>
        </nav>

        <main className="flex-1 flex flex-col justify-center py-12">
          
          {view === 'landing' && (
            <div className="max-w-4xl mx-auto text-center space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-6">
                  {library.length > 0 && (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 liquid-glass text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in duration-700">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      {library.length} Neural Fingerprints Indexed
                    </div>
                  )}
                  <h1 className="text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter text-fluid-gradient">
                    EYES ON THE <br/><span className="text-white">MUSIC.</span>
                  </h1>
                </div>
                <p className="text-neutral-400 text-xl md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed opacity-80">
                  Recall any album, EP, or single cover in your liked songs by describing its physical aesthetic.
                </p>
              </div>

              <div className="relative group max-w-2xl mx-auto">
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 rounded-[40px] blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative glass-card p-3 flex flex-col md:flex-row items-center shadow-2xl">
                  <textarea 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe the cover art (colors, shapes, objects)..."
                    className="flex-1 bg-transparent border-none outline-none p-8 text-2xl font-medium h-32 md:h-40 resize-none placeholder:text-neutral-800 text-white"
                  />
                  <button 
                    onClick={() => handleInitialIdentify()}
                    disabled={!query.trim() || isProcessing}
                    className="w-full md:w-32 h-24 md:h-32 btn-glass flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronRight className="w-10 h-10" />
                  </button>
                </div>
              </div>

              {!session && (
                <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 opacity-60">
                  <div className="w-8 h-[1px] bg-white/10" />
                  <Play className="w-3 h-3 fill-emerald-500 text-emerald-500" /> Connect Spotify to play findings
                  <div className="w-8 h-[1px] bg-white/10" />
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center gap-3 text-red-400 font-bold liquid-glass py-4 px-8 rounded-2xl border-red-500/20 mx-auto w-fit animate-shake">
                   <AlertCircle className="w-5 h-5" /> {error}
                </div>
              )}
            </div>
          )}

          {(view === 'identifying' || isProcessing) && view !== 'result' && (
            <div className="max-w-4xl mx-auto w-full space-y-16 animate-in fade-in zoom-in-95 duration-500">
               <div className="text-center space-y-12">
                  <div className="relative w-40 h-40 mx-auto">
                    <div className="absolute inset-0 border-[6px] border-white/5 rounded-full"></div>
                    <div className="absolute inset-0 border-[6px] border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-6 bg-emerald-500/10 rounded-full flex items-center justify-center animate-pulse">
                        <Sparkles className="w-12 h-12 text-emerald-400" />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-4xl font-black tracking-tight text-white uppercase tracking-tighter">Consulting Neural Archives</h2>
                    {usingFallback ? (
                      <div className="flex flex-col items-center gap-3 liquid-glass p-6 max-w-sm mx-auto">
                        <p className="text-amber-400 font-bold tracking-wide animate-pulse uppercase text-xs">API Quota Exceeded</p>
                        <p className="text-neutral-500 text-xs font-medium italic">Switching to local inference... <br/> (20-40s wait)</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-neutral-400 text-lg font-medium italic opacity-60 animate-pulse">"Comparing visual features across discography..."</p>
                      </div>
                    )}
                  </div>
               </div>

               {localMatches.length > 0 && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-1000">
                    <div className="flex flex-col items-center gap-2">
                      <div className="px-4 py-1 liquid-glass border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.4em]">Neural Intuition</div>
                      <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest">Instant matches found in your library</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 px-4">
                      {localMatches.map((match, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectCandidate(match)}
                          className="aspect-square glass-card !p-0 overflow-hidden cursor-pointer group/local hover:scale-105 active:scale-95 transition-all shadow-2xl relative border-emerald-500/40 border-4"
                          style={{ minWidth: '320px', maxWidth: '420px', margin: '0 auto' }}
                        >
                          <img src={match.image_url} alt="" className="w-full h-full object-cover opacity-80 group-hover/local:opacity-100 transition-all duration-700" />
                          <div className="absolute inset-0 flex flex-col justify-end p-8 pointer-events-none">
                            <div className="bg-black/70 rounded-xl px-4 py-3 mb-4 shadow-xl">
                              <p className="text-lg font-black text-white truncate uppercase drop-shadow-lg">{match.title}</p>
                              <p className="text-xs font-bold text-emerald-300 truncate uppercase drop-shadow-lg">{match.artist}</p>
                            </div>
                          </div>
                          <div className="absolute top-4 right-4 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover/local:opacity-100 transition-opacity shadow-lg">
                            <CheckCircle2 className="w-5 h-5 text-black" />
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
            </div>
          )}

          {view === 'questioning' && !isProcessing && (
            <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-20 items-center animate-in slide-in-from-right-16 duration-700">
              <div className="lg:col-span-7 space-y-12">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 liquid-glass text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Zap className="w-3 h-3 fill-emerald-400" /> Inference Cycle {history.length + 1}
                  </div>
                  <h2 className="text-6xl md:text-7xl font-black leading-[0.9] tracking-tighter text-white">
                    {currentQuestion}
                  </h2>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-emerald-500/10 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Specify a detail..."
                      className="relative w-full bg-white/5 border border-white/10 rounded-[30px] p-8 text-3xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-neutral-800 text-white backdrop-blur-xl"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAnswer((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button 
                       onClick={() => handleAnswer("Skip this detail")}
                       className="absolute right-6 top-1/2 -translate-y-1/2 p-5 liquid-glass rounded-2xl hover:bg-white/10 transition-all active:scale-90"
                    >
                      <ArrowLeft className="w-6 h-6 text-neutral-500 rotate-180" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center px-6">
                    <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Scope: {Array.isArray(candidates) ? candidates.length : 0} Candidates</p>
                    <button onClick={() => setView('result')} className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest hover:text-emerald-400 transition-colors">Force Prediction</button>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="pt-12 space-y-6">
                    <h4 className="text-[10px] font-black text-neutral-700 uppercase tracking-[0.3em] border-b border-white/5 pb-3">Established Visual Evidence</h4>
                    <div className="flex flex-wrap gap-3">
                      {history.map((h, i) => (
                        <div key={i} className="px-5 py-3 liquid-glass rounded-2xl text-[12px] flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                          <span className="text-neutral-500 font-medium">{h.q}</span>
                          <span className="font-black text-emerald-400">{h.a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 hidden lg:block relative">
                <div className="absolute inset-0 bg-emerald-500/10 blur-[120px] rounded-full animate-pulse"></div>
                <div className="relative space-y-8">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.3em]">Potential Matches</p>
                    <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest animate-pulse">Click to select correct cover</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 p-4">
                    {(Array.isArray(candidates) ? candidates : []).slice(0, 6).map((album, i) => (
                      <div
                        key={i}
                        onClick={() => album && handleSelectCandidate(album)}
                        className="aspect-square glass-card !p-0 flex items-center justify-center cursor-pointer group/card hover:scale-105 active:scale-95 transition-all shadow-2xl relative border-emerald-500/40 border-4"
                        style={{ minWidth: '320px', maxWidth: '420px', margin: '0 auto' }}
                      >
                        {album?.image_url ? (
                          <>
                            <img
                              src={album.image_url}
                              alt=""
                              className="w-full h-full object-cover opacity-80 group-hover/card:opacity-100 transition-all duration-700 group-hover/card:scale-110"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement?.classList.add('no-image');
                              }}
                            />
                            <div className="absolute inset-0 flex flex-col justify-end p-8 pointer-events-none">
                              <div className="bg-black/70 rounded-xl px-4 py-3 mb-4 shadow-xl">
                                <p className="text-lg font-black text-white truncate uppercase drop-shadow-lg">{album.title}</p>
                                <p className="text-xs font-bold text-emerald-300 truncate uppercase drop-shadow-lg">{album.artist}</p>
                              </div>
                            </div>
                            <div className="absolute top-4 right-4 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg">
                              <CheckCircle2 className="w-5 h-5 text-black" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <Music className="w-12 h-12 text-neutral-800 group-hover/card:text-neutral-600 transition-colors" />
                            <p className="text-lg text-neutral-800 font-black uppercase text-center px-4 line-clamp-1">{album.title}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'result' && (
            <div className="max-w-6xl mx-auto py-12 animate-in zoom-in-95 fade-in duration-1000">
              {Array.isArray(candidates) && candidates.length > 0 ? (
                <div className="space-y-20">
                    <div className="text-center space-y-6">
                      <div className="inline-flex items-center gap-2 px-6 py-2 liquid-glass border-emerald-500/30 text-emerald-400 rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-emerald-500/10">
                        <CheckCircle2 className="w-4 h-4 animate-bounce" /> Neural Match Confirmed
                      </div>
                      <h2 className="text-6xl font-black tracking-tight text-fluid-gradient">Candidate Discography</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      {(Array.isArray(candidates) ? candidates : []).slice(0, 3).map((album, idx) => {
                        if (!album) return null;
                        return (
                          <div key={idx} className={`glass-card group/result !p-0 ${idx === 0 ? 'scale-110 z-10 border-emerald-500/40 shadow-emerald-500/10 shadow-2xl' : 'opacity-40 hover:opacity-80'} transition-all duration-700`}>
                             {idx === 0 && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest z-20 shadow-xl animate-float">Primary Match</div>}
                             
                             <div className="aspect-square relative overflow-hidden">
                                {album.image_url ? (
                                  <>
                                    <img 
                                      src={album.image_url} 
                                      alt={`${album.title} cover`} 
                                      className="w-full h-full object-cover group-hover/result:scale-110 transition-transform duration-1000"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                                    <Music className="w-20 h-20 text-neutral-800" />
                                  </div>
                                )}
                             </div>

                             <div className="p-8 space-y-6">
                               <div className="space-y-2 text-center">
                                  <h3 className="text-2xl font-black leading-tight line-clamp-1 text-white uppercase tracking-tight">{album.title || 'Unknown Title'}</h3>
                                  <p className="text-emerald-500/80 font-bold uppercase text-[11px] tracking-widest">{album.artist || 'Unknown Artist'}</p>
                                  <div className="pt-4 px-2">
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed line-clamp-3 italic opacity-60">"{album.visualDescription || 'No description available.'}"</p>
                                  </div>
                               </div>

                               <div className="space-y-3">
                                 <button 
                                   onClick={() => {
                                     if (album.spotify_uri) {
                                       window.location.href = album.spotify_uri;
                                     } else if (album.spotify_url) {
                                       window.open(album.spotify_url, '_blank');
                                     }
                                   }}
                                   className="w-full py-5 bg-white text-black font-black rounded-2xl hover:scale-[1.03] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl"
                                 >
                                   <Play className="w-4 h-4 fill-black" /> OPEN IN PLAYER
                                 </button>
                                 {idx === 0 && (
                                   <button 
                                    onClick={() => { setView('questioning'); setHistory([...history, { q: "Prediction Rejection", a: "Refining visual model based on error." }]); }}
                                    className="w-full py-4 liquid-glass text-white/40 font-black rounded-2xl hover:text-white hover:bg-white/5 transition-all text-[10px] uppercase tracking-widest border-white/5"
                                   >
                                     Incorrect Prediction?
                                   </button>
                                 )}
                               </div>
                             </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center pt-10">
                      <button onClick={reset} className="text-neutral-500 font-black hover:text-white transition-all flex items-center gap-3 mx-auto uppercase text-[10px] tracking-[0.3em] liquid-glass py-4 px-10 rounded-full border-white/5">
                        <RotateCcw className="w-4 h-4" /> Reset Inference Engine
                      </button>
                    </div>
                 </div>
               ) : (
                 <div className="text-center py-24 space-y-10 liquid-glass max-w-2xl mx-auto rounded-[60px] border-white/5">
                   <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                   </div>
                   <div className="space-y-4">
                    <h2 className="text-5xl font-black text-white tracking-tighter">NEURAL PATH EXHAUSTED.</h2>
                    <p className="text-neutral-500 max-w-sm mx-auto font-medium leading-relaxed">The physical description provided does not match any known discography in our scope.</p>
                   </div>
                   <button onClick={reset} className="btn-glass px-14 py-6 text-sm uppercase tracking-widest">Re-Initialize Search</button>
                 </div>
               )}
            </div>
          )}

        </main>
      </div>

      <footer className="p-12 border-t border-white/5 bg-black/40 backdrop-blur-3xl relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] font-black text-neutral-600 tracking-[0.4em] uppercase">
          <div className="flex gap-6 items-center">
            <span className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" />Leon Nduati © 2026 Semantic Audio-Visual Retrieval </span>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}