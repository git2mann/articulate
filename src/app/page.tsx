"use client";

import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { 
  Search, Music, RotateCcw, ChevronRight, CheckCircle2, 
  Loader2, Sparkles, Globe, Zap, X, Play, ExternalLink, 
  Image as ImageIcon, MessageCircle, AlertCircle, ArrowLeft,
  LogIn, LogOut, Pause, PlayCircle, Square, MoreHorizontal,
  Plus, Settings, Layout, List, Map as MapIcon, History,
  FileText, Home, Layers, Headphones, Circle, Triangle, Square as SquareIcon
} from 'lucide-react';

import { AlbumCandidate, SessionWithToken, CoverObject } from '@/types';
import { getEmbedding, computeCosineSimilarity, analyzeImageLocally } from '@/lib/embeddings';
import { saveLibraryToDB, getLibraryFromDB } from '@/lib/db';
import AlbumGrid from '@/components/AlbumGrid';
import VisualDNADashboard from '@/components/VisualDNADashboard';
import SemanticMap from '@/components/SemanticMap';

// Simple notification component
function Notification({ message, onClose }: { message: string, onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#d32f2f] text-white px-8 py-4 border-[3px] border-black font-black uppercase tracking-widest animate-in">
      <div className="flex items-center gap-4">
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="hover:scale-125 transition-transform">×</button>
      </div>
    </div>
  );
}

export default function App() {
  const [notification, setNotification] = useState<string>("");
  const { data: session } = useSession() as { data: SessionWithToken | null };
  const [view, setView] = useState('landing'); 
  const [libraryView, setLibraryView] = useState('grid'); 
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<AlbumCandidate[]>([]);
  const [localMatches, setLocalMatches] = useState<any[]>([]);
  const [library, setLibrary] = useState<AlbumCandidate[]>([]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'fetching' | 'indexing' | 'complete' | 'error'>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [syncSubText, setSyncSubText] = useState("");
  const [albumsToSync, setAlbumsToSync] = useState<any[]>([]);
  const [currentSyncIndex, setCurrentSyncIndex] = useState(0);
  
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<{q: string, a: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const shouldStopRef = React.useRef(false);
  const isPausedRef = React.useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    setMounted(true);
    const hydrate = async () => {
      const legacySaved = localStorage.getItem('cover_recall_library');
      if (legacySaved) {
        const data = JSON.parse(legacySaved);
        setLibrary(data);
        await saveLibraryToDB(data);
        localStorage.removeItem('cover_recall_library');
      } else {
        try {
          const dbData = await getLibraryFromDB();
          if (dbData && dbData.length > 0) setLibrary(dbData);
        } catch (e) { console.error(e); }
      }
    };
    hydrate();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 5000);
  };

  const waitIfPaused = async () => {
    while (isPausedRef.current && !shouldStopRef.current) {
      await new Promise(res => setTimeout(res, 500));
    }
  };

  const stopSync = () => {
    shouldStopRef.current = true;
    setIsSyncing(false);
    setIsPaused(false);
    setSyncStatus('idle');
    showNotification("Sync stopped.");
  };

  const syncLibrary = async () => {
    if (!session?.accessToken) { signIn('spotify'); return; }
    setIsSyncing(true); setIsPaused(false); setSyncProgress(0); setSyncStatus('fetching'); setError(null);
    shouldStopRef.current = false;

    try {
      const allSongs: any[] = []; let offset = 0; let total = 50; 
      setSyncSubText("GETTING METADATA...");
      while (offset < total) {
        if (shouldStopRef.current) return;
        await waitIfPaused();
        const songsResp = await fetch(`https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` }
        });
        if (!songsResp.ok) break;
        const songsData = await songsResp.json();
        if (!songsData.items) break;
        allSongs.push(...songsData.items);
        total = songsData.total; offset += 50;
        setSyncProgress(Math.min(20, Math.round((offset / total) * 20)));
      }

      const uniqueAlbumsMap = new Map<string, any>();
      allSongs.forEach(item => {
        if (item.track?.album) uniqueAlbumsMap.set(item.track.album.id, { album: item.track.album, track: item.track });
      });

      const uniqueAlbums = Array.from(uniqueAlbumsMap.values());
      const numAlbums = uniqueAlbums.length;
      setAlbumsToSync(uniqueAlbums);
      setSyncStatus('indexing');
      
      const newLibrary: AlbumCandidate[] = [];
      for (let i = 0; i < numAlbums; i++) {
        if (shouldStopRef.current) break;
        await waitIfPaused();
        setCurrentSyncIndex(i);
        const { album, track } = uniqueAlbums[i];
        setSyncSubText(`INDEXING: ${album.name.toUpperCase()}`);

        const existing = library.find(libItem => libItem.id === album.id);
        if (existing && existing.embedding && existing.embedding.length > 0 && existing.tags) {
          newLibrary.push(existing);
          setSyncProgress(20 + Math.round(((i + 1) / numAlbums) * 80));
          continue;
        }

        let indexData: any = null;
        try {
          indexData = await analyzeImageLocally(album.images[0]?.url, album.name, album.artists[0].name);
          if (!indexData || !indexData.description) continue;
          const embedding = await getEmbedding(indexData.description);
          newLibrary.push({
            id: album.id, title: album.name, artist: album.artists[0].name,
            image_url: album.images[0].url, spotify_url: album.external_urls.spotify,
            spotify_uri: track.uri || album.uri, visualDescription: indexData.description,
            embedding: embedding, tags: indexData.tags, confidence: 1
          });
        } catch (e) { console.error(e); }
        setSyncProgress(20 + Math.round(((i + 1) / numAlbums) * 80));
        await new Promise(res => setTimeout(res, indexData?.isLocal ? 100 : 4000));
      }

      setLibrary(newLibrary); await saveLibraryToDB(newLibrary);
      setSyncStatus('complete'); showNotification("SYNC COMPLETE");
      setTimeout(() => setIsSyncing(false), 2000);
    } catch (err) { setSyncStatus('error'); }
  };

  const handleInitialIdentify = async () => {
    if (!query.trim()) return;
    setIsProcessing(true); setView('identifying'); setLocalMatches([]);
    
    try {
      const queryEmbedding = await getEmbedding(query);
      if (queryEmbedding && queryEmbedding.length > 0) {
        const matches = library.filter(item => Array.isArray(item.embedding) && item.embedding.length > 0)
          .map(item => ({ ...item, similarity: computeCosineSimilarity(queryEmbedding, item.embedding as number[]) }))
          .filter(s => s.similarity > 0.45).sort((a, b) => b.similarity - a.similarity).slice(0, 4);
        setLocalMatches(matches);
      }
    } catch (e) {}

    try {
      const data = await fetch('/api/global-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, action: 'initial', libraryContext: library.map(l => ({ title: l.title, artist: l.artist, visualDescription: l.visualDescription })) })
      }).then(r => r.json());
      setCandidates(data.candidates || []);
      setCurrentQuestion(data.discriminatorQuestion);
      setView('questioning');
    } catch (err) { setView('landing'); }
    setIsProcessing(false);
  };

  const handleAnswer = async (answer: string) => {
    setIsProcessing(true); const newHistory = [...history, { q: currentQuestion, a: answer }]; setHistory(newHistory);
    try {
      const data = await fetch('/api/global-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, action: 'refine', history: newHistory, candidates })
      }).then(r => r.json());
      if (data.action === "search_refresh") { handleInitialIdentify(); } 
      else {
        const nextCands = data.updatedCandidates || candidates; setCandidates(nextCands);
        if (data.action === "finalize" || nextCands.length === 1) setView('result');
        else setCurrentQuestion(data.nextQuestion);
      }
    } catch (err) { setView('result'); }
    setIsProcessing(false);
  };

  const reset = () => { setView('landing'); setQuery(''); setCandidates([]); setHistory([]); setError(null); };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#e8e4db] text-black overflow-hidden font-sans border-[12px] border-black">
      <Notification message={notification} onClose={() => setNotification("")} />
      
      {/* Bauhaus Sidebar */}
      <aside className={`w-80 bg-white border-r-[6px] border-black flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-0' : '-ml-80'}`}>
        <div className="p-8 border-b-[6px] border-black bg-[#fbc02d] flex items-center justify-center">
          <img src="/brand/logo-black.png" alt="Articulate" className="h-16 w-auto mix-blend-multiply" />
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <div 
            onClick={reset}
            className={`bauhaus-button w-full justify-start gap-4 ${view !== 'library' ? 'bauhaus-button-primary' : ''}`}
          >
            <Circle className="w-4 h-4 fill-current" /> RECALL
          </div>
          <div 
            onClick={() => setView('library')}
            className={`bauhaus-button w-full justify-start gap-4 ${view === 'library' ? 'bauhaus-button-red' : ''}`}
          >
            <SquareIcon className="w-4 h-4 fill-current" /> ARCHIVE ({library.length})
          </div>
          
          <div className="pt-8 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest px-2 pb-2 opacity-30">Mechanical Operations</div>
            <button onClick={syncLibrary} className="bauhaus-button w-full justify-start gap-4 hover:bg-[#fbc02d]">
              <RotateCcw className="w-4 h-4" /> {isSyncing ? `${syncProgress}%` : 'SYNC SYSTEM'}
            </button>
            {session ? (
              <button onClick={() => signOut()} className="bauhaus-button w-full justify-start gap-4 hover:bg-[#d32f2f] hover:text-white">
                <LogOut className="w-4 h-4" /> DISCONNECT
              </button>
            ) : (
              <button onClick={() => signIn('spotify')} className="bauhaus-button w-full justify-start gap-4 bg-[#1976d2] text-white">
                <LogIn className="w-4 h-4" /> CONNECT
              </button>
            )}
          </div>
        </nav>

        <div className="p-8 border-t-[6px] border-black text-[10px] font-black uppercase tracking-widest">
          FORM FOLLOWS FUNCTION // 2026
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-y-auto">
        <header className="h-20 border-b-[6px] border-black flex items-center px-8 justify-between bg-white">
          <div className="flex items-center gap-6">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors">
              <Layout className="w-5 h-5" />
            </button>
            <div className="h-10 w-[2px] bg-black/10" />
            <img src="/brand/logo-black.png" alt="" className="h-8 w-auto grayscale" />
            <span className="font-black uppercase tracking-widest text-xs opacity-40">Workspace / {view.toUpperCase()}</span>
          </div>
          <div className="flex gap-1">
            <div className="w-6 h-6 bg-[#d32f2f]" />
            <div className="w-6 h-6 bg-[#1976d2]" />
            <div className="w-6 h-6 bg-[#fbc02d]" />
          </div>
        </header>

        <div className="flex-1 p-12 lg:p-24 space-y-24">
          
          {view === 'landing' && (
            <div className="space-y-16 animate-in">
              <h1 className="bauhaus-h1">Eyes on the<br/>Sound.</h1>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                <div className="lg:col-span-8 space-y-8">
                  <div className="bg-black text-white p-2 inline-block font-black uppercase tracking-widest text-xs px-4">Input Neural Description</div>
                  <textarea 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="DESCRIBE COLORS, SHAPES, OBJECTS..."
                    className="w-full text-5xl font-black bg-transparent border-none outline-none resize-none placeholder:text-black/10 uppercase"
                  />
                  <div className="flex justify-start">
                    <button 
                      onClick={handleInitialIdentify}
                      disabled={!query.trim() || isProcessing}
                      className="bauhaus-button-primary bauhaus-button px-12 py-6 text-xl"
                    >
                      INITIALIZE MATCH <ChevronRight className="w-6 h-6 ml-4" />
                    </button>
                  </div>
                </div>
                
                <div className="lg:col-span-4 space-y-8">
                   <div className="w-full aspect-square border-[6px] border-black relative bg-[#fbc02d]">
                      <div className="absolute inset-8 border-[6px] border-black rounded-full" />
                      <div className="absolute inset-20 bg-black" />
                   </div>
                   <p className="font-bold text-sm uppercase leading-tight">Articulate uses local neural fingerprints to retrieve visual data without external vision APIs.</p>
                </div>
              </div>
            </div>
          )}

          {(view === 'identifying' || isProcessing) && view !== 'result' && (
            <div className="space-y-12 animate-in py-12">
               <div className="flex items-center gap-12">
                 <div className="w-32 h-32 border-[12px] border-black rounded-full border-t-[#d32f2f] animate-spin" />
                 <div>
                   <h2 className="bauhaus-h2">Consulting Archives</h2>
                   <div className="flex gap-2 mt-4">
                     {[1,2,3,4,5].map(i => <div key={i} className="w-12 h-3 bg-black animate-pulse" style={{animationDelay: `${i*100}ms`}} />)}
                   </div>
                 </div>
               </div>

               {localMatches.length > 0 && (
                 <div className="space-y-8 pt-12 border-t-[6px] border-black">
                    <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-4">
                      <div className="w-4 h-4 bg-[#fbc02d] rounded-full" /> INSTANT INTUITION
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {localMatches.map((match, i) => (
                        <div key={i} onClick={() => setCandidates([match]) || setView('result')} className="bauhaus-card p-4 group cursor-pointer">
                           <div className="aspect-square border-[3px] border-black mb-4 overflow-hidden">
                              <img src={match.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                           </div>
                           <p className="font-black uppercase truncate text-sm">{match.title}</p>
                           <p className="font-bold uppercase text-[10px] text-[#1976d2]">{match.artist}</p>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
            </div>
          )}

          {view === 'questioning' && !isProcessing && (
            <div className="space-y-16 animate-in">
              <div className="space-y-8">
                <div className="bg-[#d32f2f] text-white p-2 inline-block font-black uppercase tracking-widest text-xs px-4">
                   Inference Cycle {history.length + 1}
                </div>
                <h1 className="bauhaus-h1 !border-none !p-0 leading-[0.8]">{currentQuestion.toUpperCase()}</h1>
              </div>

              <div className="space-y-12">
                <input 
                  type="text" autoFocus placeholder="TYPE TO REFINE..."
                  className="w-full text-6xl font-black bg-transparent border-none outline-none placeholder:text-black/10 uppercase"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleAnswer((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; }
                  }}
                />

                {history.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-[6px] border-black pt-12">
                    {history.map((h, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <span className="font-black uppercase text-[10px] opacity-30">{h.q}</span>
                        <span className="font-black uppercase text-2xl border-l-[6px] border-[#1976d2] pl-4">{h.a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'result' && (
            <div className="space-y-24 animate-in">
              <div className="flex flex-col md:flex-row justify-between items-start gap-12">
                <h1 className="bauhaus-h1 leading-[0.8]">Retrieved<br/>Data.</h1>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 bg-[#0f7b6c] text-white p-4 border-[3px] border-black">
                    <CheckCircle2 className="w-8 h-8" />
                    <span className="font-black uppercase tracking-widest">Match Confirmed</span>
                  </div>
                  <button onClick={reset} className="bauhaus-button w-full">RE-INITIALIZE</button>
                </div>
              </div>

              <div className="space-y-12">
                {candidates.slice(0, 3).map((album, idx) => (
                  <div key={idx} className={`bauhaus-card p-12 flex flex-col lg:flex-row gap-12 ${idx === 0 ? 'bg-white scale-105 z-10' : 'opacity-40 hover:opacity-100'}`}>
                    <div className="w-full lg:w-96 aspect-square border-[6px] border-black shrink-0 relative">
                       <img src={album.image_url} alt="" className="w-full h-full object-cover" />
                       {idx === 0 && <div className="absolute -top-4 -left-4 bg-[#d32f2f] text-white px-4 py-2 font-black text-xs uppercase border-[3px] border-black">Primary</div>}
                    </div>
                    <div className="flex-1 space-y-8">
                      <div className="space-y-2">
                        <h3 className="text-6xl font-black uppercase tracking-tighter leading-none">{album.title}</h3>
                        <p className="text-3xl font-bold uppercase text-[#1976d2]">{album.artist}</p>
                      </div>
                      <div className="text-lg font-bold uppercase leading-tight bg-[#e8e4db] p-8 border-[3px] border-black italic">
                        &quot;{album.visualDescription}&quot;
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <button 
                          onClick={() => { if (album.spotify_uri) window.location.href = album.spotify_uri; else if (album.spotify_url) window.open(album.spotify_url, '_blank'); }}
                          className="bauhaus-button-primary bauhaus-button px-10 py-5 text-lg flex-1 md:flex-none"
                        >
                          <Play className="w-6 h-6 fill-white mr-4" /> PLAY NOW
                        </button>
                        {idx === 0 && (
                          <button onClick={() => setView('questioning')} className="bauhaus-button px-10 py-5 text-lg flex-1 md:flex-none">
                            <History className="w-6 h-6 mr-4" /> REFINE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'library' && (
            <div className="space-y-16 animate-in">
              <div className="flex flex-col lg:flex-row justify-between items-end gap-12">
                <h1 className="bauhaus-h1">Visual<br/>Archive.</h1>
                <div className="flex border-[3px] border-black bg-white">
                  {[
                    { id: 'grid', label: 'GRID', icon: Layout },
                    { id: 'dna', label: 'DNA', icon: Zap },
                    { id: 'map', label: 'MAP', icon: Globe },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLibraryView(tab.id)}
                      className={`px-8 py-4 text-xs font-black transition-all ${
                        libraryView === tab.id ? 'bg-black text-white' : 'hover:bg-[#fbc02d]'
                      } ${tab.id !== 'map' ? 'border-r-[3px] border-black' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-[600px] border-t-[6px] border-black pt-12">
                {libraryView === 'grid' && <AlbumGrid covers={library as unknown as CoverObject[]} />}
                {libraryView === 'dna' && <div className="max-w-4xl mx-auto"><VisualDNADashboard covers={library as unknown as CoverObject[]} /></div>}
                {libraryView === 'map' && <SemanticMap covers={library as unknown as CoverObject[]} />}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bauhaus Sync Panel */}
      {isSyncing && (
        <div className="fixed bottom-0 right-0 z-[100] w-full md:w-[500px] bg-white border-l-[12px] border-t-[12px] border-black animate-in p-8 space-y-8 shadow-[20px_20px_0px_rgba(0,0,0,0.2)]">
          <div className="flex justify-between items-center bg-black text-white p-4">
             <div className="flex items-center gap-4">
               <img src="/brand/logo-white.png" alt="" className="h-4 w-auto brightness-200" />
               <div className="w-[2px] h-4 bg-white/20" />
               <span className="font-black text-[10px] uppercase tracking-widest opacity-60">Mechanical Indexing</span>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setIsPaused(!isPaused)} className="hover:text-[#fbc02d] transition-colors">
                  {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                </button>
                <button onClick={stopSync} className="hover:text-[#d32f2f] transition-colors">
                  <X className="w-6 h-6 stroke-[4px]" />
                </button>
             </div>
          </div>
          <div className="space-y-6">
             <div className="flex justify-between items-baseline">
               <div className="text-7xl font-black">{syncProgress}%</div>
               <div className="text-xs font-black uppercase text-black/30">
                 {syncStatus === 'indexing' && albumsToSync.length > 0 ? `${currentSyncIndex + 1}/${albumsToSync.length}` : 'SYSTEM ACTIVE'}
               </div>
             </div>
             <div className="h-10 bg-black p-2">
               <div className="h-full bg-[#d32f2f] transition-all duration-300" style={{ width: `${syncProgress}%` }} />
             </div>
             <p className="text-xs font-black uppercase tracking-tighter leading-tight bg-[#fbc02d] p-4 border-[3px] border-black">{syncSubText}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Download(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
