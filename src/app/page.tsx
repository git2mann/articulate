"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn, signOut } from "next-auth/react";
import { 
  Search, Music, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, 
  Loader2, Sparkles, Globe, Zap, X, Play, ExternalLink, 
  Activity, Image as ImageIcon, MessageCircle, AlertCircle, ArrowLeft,
  LogIn, LogOut, Pause, PlayCircle, Square, MoreHorizontal,
  Plus, Settings, Layout, List, Map as MapIcon, History, Target,
  FileText, Home, Layers, Headphones, Circle, Triangle, Square as SquareIcon,
  Sun, Moon, Monitor, Minimize2, Maximize2
} from 'lucide-react';

import { AlbumCandidate, SessionWithToken, CoverObject } from '@/types';
import { getEmbedding, computeCosineSimilarity, analyzeImageLocally } from '@/lib/embeddings';
import { saveLibraryToDB, getLibraryFromDB, clearLibraryFromDB } from '@/lib/db';
import AlbumGrid from '@/components/AlbumGrid';
import VisualDNADashboard from '@/components/VisualDNADashboard';
import SemanticMap from '@/components/SemanticMap';
import { useTheme } from '@/components/ThemeContext';
import { Vibrant } from 'node-vibrant/browser';

// Simple notification component
function Notification({ message, onClose }: { message: string, onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-accent text-background px-8 py-4 border-[1px] border-background/20 font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-4 duration-500 rounded-full shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span className="text-xs">{message}</span>
        <button onClick={onClose} className="hover:scale-125 transition-transform opacity-60">×</button>
      </div>
    </div>
  );
}

export default function App() {
  const [notification, setNotification] = useState<string>("");
  const [isSyncMinimized, setIsSyncMinimized] = useState(false);
  const { data: session } = useSession() as { data: SessionWithToken | null };
  const [view, setView] = useState('landing'); 

  const [libraryView, setLibraryView] = useState('grid'); 
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<AlbumCandidate[]>([]);
  const [localMatches, setLocalMatches] = useState<any[]>([]);
  const [library, setLibrary] = useState<AlbumCandidate[]>([]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const taglines = ["See what you heard", "Eyes on the music"];

  useEffect(() => {
    const timer = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'fetching' | 'indexing' | 'complete' | 'error'>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [syncSubText, setSyncSubText] = useState("");
  const [albumsToSync, setAlbumsToSync] = useState<any[]>([]);
  const [currentSyncIndex, setCurrentSyncIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [syncLimit, setSyncLimit] = useState(50);
  const [indexingMode, setIndexingMode] = useState<'hybrid' | 'remote' | 'local' | 'ollama'>('hybrid');
  const [currentSyncColors, setCurrentSyncColors] = useState({ primary: '#d4af37', soft: 'rgba(212, 175, 55, 0.1)' });
  const [resultColors, setResultColors] = useState({ primary: '#d4af37', soft: 'rgba(212, 175, 55, 0.1)' });
  
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<{q: string, a: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectableAlbums, setSelectableAlbums] = useState<any[]>([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());
  const [isFetchingSelectable, setIsFetchingSelectable] = useState(false);

  const shouldStopRef = React.useRef(false);
  const isPausedRef = React.useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    setMounted(true);
    const hydrate = async () => {
      const data = await getLibraryFromDB();
      if (data && data.length > 0) setLibrary(data);
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
    setSyncStatus('idle');
  };

  const clearVault = async () => {
    if (confirm("Are you sure you want to clear your visual vault? This will remove all indexed covers.")) {
      await clearLibraryFromDB();
      setLibrary([]);
      showNotification("VAULT CLEARED");
    }
  };

  const fetchSelectableAlbums = async () => {
    if (!session?.accessToken) { signIn('spotify'); return; }
    setIsFetchingSelectable(true);
    setIsSelectionModalOpen(true);
    
    try {
      const resp = await fetch(`https://api.spotify.com/v1/me/tracks?limit=50`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const data = await resp.json();
      
      const unique = new Map<string, any>();
      data.items?.forEach((item: any) => {
        if (item.track?.album) unique.set(item.track.album.id, { album: item.track.album, track: item.track });
      });
      
      setSelectableAlbums(Array.from(unique.values()));
    } catch (e) {
      console.error("Failed to fetch selectable albums", e);
    } finally {
      setIsFetchingSelectable(false);
    }
  };

  const startSelectiveSync = () => {
    const selected = selectableAlbums.filter(a => selectedAlbumIds.has(a.album.id));
    if (selected.length === 0) return;
    setIsSelectionModalOpen(false);
    syncLibrary(false, selected);
  };

  const syncLibrary = async (forceRefresh = false, customQueue?: any[]) => {
    if (isSyncing) return;
    if (!session?.accessToken) { signIn('spotify'); return; }
    setIsSyncing(true); setIsPaused(false); setSyncProgress(0); setSyncStatus('fetching'); setError(null);
    shouldStopRef.current = false;
    
    remoteLog(`Starting Library Sync (Refresh: ${forceRefresh}, Limit: ${syncLimit}, Custom: ${!!customQueue})`, 'INFO');

    try {
      let uniqueAlbums: any[] = [];
      let alreadyIndexedCount = 0;

      if (customQueue) {
        uniqueAlbums = customQueue;
        alreadyIndexedCount = 0;
      } else {
        const allSongs: any[] = []; let offset = 0; let totalToFetch = syncLimit; 
        setSyncSubText("GETTING METADATA...");
        while (offset < totalToFetch) {
          if (shouldStopRef.current) return;
          await waitIfPaused();
          const songsResp = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${Math.min(50, totalToFetch - offset)}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${session.accessToken}` }
          });

          if (songsResp.status === 401) {
            remoteLog("Spotify session expired (401)", 'WARN');
            signOut();
            return;
          }

          if (!songsResp.ok) {
            remoteLog(`Spotify API error: ${songsResp.status}`, 'ERROR');
            break;
          }
          const songsData = await songsResp.json();
          if (!songsData.items) break;
          allSongs.push(...songsData.items);
          if (songsData.total < totalToFetch) totalToFetch = songsData.total;
          offset += 50;
          setSyncProgress(Math.min(20, Math.round((allSongs.length / totalToFetch) * 20)));
        }

        const uniqueAlbumsMap = new Map<string, any>();
        allSongs.forEach(item => {
          if (item.track?.album) uniqueAlbumsMap.set(item.track.album.id, { album: item.track.album, track: item.track });
        });

        uniqueAlbums = Array.from(uniqueAlbumsMap.values());
      }

      const albumsToProcess = (forceRefresh && !customQueue)
        ? uniqueAlbums 
        : uniqueAlbums.filter(a => !library.find(libItem => libItem.id === a.album.id));

      if (!customQueue) {
        alreadyIndexedCount = uniqueAlbums.length - albumsToProcess.length;
      }
      
      remoteLog(`Meta-analysis complete. ${uniqueAlbums.length} unique albums found. ${albumsToProcess.length} need indexing.`, 'INFO');
      
      setAlbumsToSync(uniqueAlbums);
      setSyncStatus('indexing');
      
      const CONCURRENCY_LIMIT = 1;
      let completedCount = alreadyIndexedCount;

      const analyzeImageRemotely = async (image_url: string, album_name: string) => {
        try {
          if (indexingMode === 'ollama') setSyncSubText(`LOCAL GPU INFERENCE...`);
          else if (indexingMode === 'remote') setSyncSubText(`GROQ CLOUD ANALYSIS...`);
          
          const resp = await fetch('/api/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url, album_name })
          });
          if (!resp.ok) {
            if (resp.status === 429) console.warn(`[Groq] Rate limit hit for ${album_name}`);
            return null;
          }
          return await resp.json();
        } catch (e) {
          return null;
        }
      };

      const processAlbum = async (albumData: any, globalIndex: number) => {
        if (shouldStopRef.current) return;
        await waitIfPaused();
        
        const { album, track } = albumData;
        try {
          setCurrentSyncIndex(globalIndex);
          setSyncSubText(`ANALYZING: ${album.name.toUpperCase()}`);
          
          let indexData = null;

          if (indexingMode === 'hybrid' || indexingMode === 'remote' || indexingMode === 'ollama') {
            indexData = await analyzeImageRemotely(album.images[0]?.url, album.name);
            if (indexingMode === 'hybrid' || indexingMode === 'remote') await new Promise(r => setTimeout(r, 1000));
          }
          
          if (!indexData && (indexingMode === 'hybrid' || indexingMode === 'local' || indexingMode === 'ollama')) {
            indexData = await analyzeImageLocally(album.images[0]?.url, album.name, album.artists[0].name, setSyncSubText);
          }
          
          if (indexData && indexData.tags?.colors?.length > 0) {
            const primary = indexData.tags.colors[0];
            setCurrentSyncColors({ 
              primary: primary, 
              soft: primary.replace('rgb', 'rgba').replace(')', ', 0.1)') 
            });
          }

          if (indexData && indexData.description) {
            const embedding = await getEmbedding(indexData.description);
            const newItem: AlbumCandidate = {
              id: album.id, title: album.name, artist: album.artists[0].name,
              image_url: album.images[0].url, spotify_url: album.external_urls.spotify,
              spotify_uri: track.uri || album.uri, visualDescription: indexData.description,
              embedding: embedding, tags: indexData.tags, confidence: 1
            };
            
            setLibrary(prev => {
              const existsIndex = prev.findIndex(item => item.id === newItem.id);
              let updated;
              if (existsIndex !== -1) {
                updated = [...prev];
                updated[existsIndex] = newItem;
              } else {
                updated = [...prev, newItem];
              }
              return updated;
            });
            
            await saveLibraryToDB([newItem]);
          }
        } catch (e) { 
          console.error(`[Sync] Error processing ${album.name}:`, e); 
        }
        
        completedCount++;
        setSyncProgress(20 + Math.round((completedCount / uniqueAlbums.length) * 80));
      };

      const queue = [...albumsToProcess.map(a => ({ data: a, originalIndex: uniqueAlbums.indexOf(a) }))];
      const workers = Array(Math.min(CONCURRENCY_LIMIT, queue.length)).fill(null).map(async () => {
        while (queue.length > 0 && !shouldStopRef.current) {
          const item = queue.shift();
          if (item) await processAlbum(item.data, item.originalIndex);
        }
      });

      await Promise.all(workers);

      setSyncStatus('complete'); showNotification("SYNC COMPLETE");
      setTimeout(() => setIsSyncing(false), 2000);
    } catch (err) { setSyncStatus('error'); }
  };

  const handleInitialIdentify = async () => {
    if (!query.trim()) return;
    setIsProcessing(true); setView('identifying');
    const action = 'initial';
    
    try {
      const libraryContext = library.map(l => ({ 
        id: l.id, title: l.title, artist: l.artist, visualDescription: l.visualDescription, image_url: l.image_url 
      }));

      const data = await fetch('/api/global-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, action, libraryContext })
      }).then(r => r.json());

      if (data.results && data.results.length > 0) {
        const fullResults = data.results.map((r: any) => {
          // Priority 1: Check local vault (most reliable)
          const local = library.find(l => l.id === r.id);
          // Priority 2: Check current candidates (persists augmented data)
          const current = candidates.find(c => c.id === r.id);
          
          if (local) return { ...local, confidence: r.confidence };
          if (current) return { ...current, ...r, image_url: current.image_url || r.image_url };
          return r;
        });
        setCandidates(fullResults);
        setLocalMatches(fullResults.filter((r: any) => library.some(l => l.id === r.id)));
      }

      if (data.question) {
        setCurrentQuestion(data.question);
        setView('questioning');
      } else {
        const bestMatch = data.results?.[0];
        if (bestMatch?.image_url) {
          try {
            const palette = await Vibrant.from(bestMatch.image_url).getPalette();
            setResultColors({
              primary: palette.Vibrant?.hex || '#d4af37',
              soft: (palette.Vibrant?.hex || '#d4af37') + '1a'
            });
          } catch (e) { console.error("Palette extraction failed", e); }
        }
        setView('result');
      }
    } catch (e) {
      console.error(e);
      setError("Failed to consult memory.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!answer.trim() || isProcessing) return;
    setIsProcessing(true);
    const newHistory = [...history, { q: currentQuestion, a: answer }];
    setHistory(newHistory);
    const action = 'refine';

    try {
      const libraryContext = library.map(l => ({ 
        id: l.id, title: l.title, artist: l.artist, visualDescription: l.visualDescription, image_url: l.image_url 
      }));

      const data = await fetch('/api/global-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          action, 
          history: newHistory,
          libraryContext,
          candidates: candidates.map(c => ({ id: c.id, title: c.title, artist: c.artist, visualDescription: c.visualDescription }))
        })
      }).then(r => r.json());

      if (data.results && data.results.length > 0) {
        const fullResults = data.results.map((r: any) => {
          const local = library.find(l => l.id === r.id);
          const current = candidates.find(c => c.id === r.id);
          
          if (local) return { ...local, confidence: r.confidence };
          if (current) return { ...current, ...r, image_url: current.image_url || r.image_url };
          return r;
        });
        setCandidates(fullResults);
      } else {
        // If API returns no results, keep the current ones but move to result view
        const bestMatch = candidates[0];
        if (bestMatch?.image_url) {
          try {
            const palette = await Vibrant.from(bestMatch.image_url).getPalette();
            setResultColors({
              primary: palette.Vibrant?.hex || '#d4af37',
              soft: (palette.Vibrant?.hex || '#d4af37') + '1a'
            });
          } catch (e) { console.error("Palette extraction failed", e); }
        }
        setView('result');
      }

      if (data.question && !data.isComplete) {
        setCurrentQuestion(data.question);
      } else {
        const bestMatch = data.results?.[0] || candidates[0];
        if (bestMatch?.image_url) {
          try {
            const palette = await Vibrant.from(bestMatch.image_url).getPalette();
            setResultColors({
              primary: palette.Vibrant?.hex || '#d4af37',
              soft: (palette.Vibrant?.hex || '#d4af37') + '1a'
            });
          } catch (e) { console.error("Palette extraction failed", e); }
        }
        setView('result');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => { setView('landing'); setQuery(''); setCandidates([]); setHistory([]); setError(null); };
  const { theme, setTheme } = useTheme();

  const remoteLog = async (message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO', metadata?: any) => {
    try {
      fetch('/api/diag/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, level, metadata })
      }).catch(() => {});
    } catch (e) {}
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen text-foreground overflow-hidden font-serif relative transition-colors duration-500">
      <Notification message={notification} onClose={() => setNotification("")} />
      
      {/* Elegant Sidebar */}
      <aside className={`glass-card border-none flex flex-col transition-all duration-700 z-50 overflow-hidden ${sidebarOpen ? 'w-72 m-4 mr-0 opacity-100' : 'w-0 m-0 opacity-0'}`}>
        <div className="w-72 flex-1 flex flex-col">
          <div className="py-16 px-6 flex flex-col items-center justify-center gap-6">
            <img src="/brand/logo-black.png" alt="Articulate" className="h-48 w-auto logo-invert" />
            <span className="text-2xl font-light tracking-tighter opacity-80" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>articulate.</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
            <div onClick={reset} className={`sidebar-link cursor-pointer ${view !== 'library' ? 'active' : ''}`}>
              <Circle className="w-4 h-4" /> 
              <span className="text-sm font-medium tracking-wide uppercase">Recall</span>
            </div>
            <div onClick={() => setView('library')} className={`sidebar-link cursor-pointer ${view === 'library' ? 'active' : ''}`}>
              <SquareIcon className="w-4 h-4" /> 
              <span className="text-sm font-medium tracking-wide uppercase">Archive ({library.length})</span>
            </div>
            
            <div className="pt-12 px-4 space-y-8 pb-12">
              <div className="space-y-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30">Operations</div>
                
                {isSyncing && isSyncMinimized ? (
                  <div className="space-y-6 bg-foreground/[0.03] p-4 rounded-xl border border-foreground/5 relative group">
                    <div className="flex justify-between items-start">
                      <div className="relative w-12 h-12 shrink-0">
                        <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full animate-pulse" />
                        <div className="relative w-full h-full rounded-lg overflow-hidden border border-foreground/10 shadow-lg bg-background/50">
                          {albumsToSync[currentSyncIndex]?.album?.images[0]?.url ? (
                            <motion.img key={albumsToSync[currentSyncIndex].album.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={albumsToSync[currentSyncIndex].album.images[0].url} className="w-full h-full object-cover" alt="" />
                          ) : <Zap className="w-4 h-4 m-4 opacity-20" />}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setIsSyncMinimized(false)} className="p-1.5 rounded-full hover:bg-foreground/5 opacity-40 hover:opacity-100 transition-all"><Maximize2 className="w-3.5 h-3.5" /></button>
                        <button onClick={stopSync} className="p-1.5 rounded-full hover:bg-foreground/5 opacity-40 hover:opacity-100 transition-all"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-baseline"><span className="text-xl font-light tracking-tighter tabular-nums">{syncProgress}%</span><span className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-30">{currentSyncIndex + 1} / {albumsToSync.length}</span></div>
                      <div className="h-0.5 bg-foreground/5 rounded-full overflow-hidden"><motion.div className="h-full bg-accent" animate={{ width: `${syncProgress}%` }} /></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1"><span className="text-[9px] font-bold uppercase tracking-widest opacity-20">Volume</span><span className="text-[10px] font-bold opacity-40">{syncLimit} Songs</span></div>
                      <input type="range" min="10" max="1000" step="10" value={syncLimit} onChange={(e) => setSyncLimit(parseInt(e.target.value))} className="w-full accent-accent opacity-40 hover:opacity-100 transition-opacity cursor-pointer h-1 bg-foreground/5 rounded-full appearance-none" />
                    </div>
                    <div className="space-y-3">
                      <div className="text-[9px] font-bold uppercase tracking-widest opacity-20 px-1">Visual Analysis</div>
                      <div className="grid grid-cols-2 gap-1.5 bg-foreground/5 p-1.5 rounded-xl">
                        {[ { id: 'hybrid', label: 'SMART', icon: Sparkles, sub: 'Auto' }, { id: 'remote', label: 'CLOUD', icon: Globe, sub: 'Accurate' }, { id: 'ollama', label: 'LOCAL', icon: Zap, sub: 'M1 Pro' }, { id: 'local', label: 'BROWSER', icon: Activity, sub: 'Privacy' } ].map((mode) => (
                          <button key={mode.id} onClick={() => setIndexingMode(mode.id as any)} className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all ${indexingMode === mode.id ? 'bg-background shadow-sm opacity-100' : 'opacity-30 hover:opacity-60'}`}><div className="flex items-center gap-1.5"><mode.icon className="w-2.5 h-2.5" /><span className="text-[8px] font-bold tracking-widest">{mode.label}</span></div><span className="text-[6px] font-medium opacity-40 uppercase tracking-tighter">{mode.sub}</span></button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => syncLibrary(false)} disabled={isSyncing} className="flex items-center justify-center gap-3 py-3 rounded-lg bg-foreground text-background text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"><RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Sync</button>
                      <button onClick={fetchSelectableAlbums} disabled={isSyncing} className="flex items-center justify-center gap-3 py-3 rounded-lg border border-foreground/5 hover:bg-foreground/5 text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"><List className="w-3.5 h-3.5" /> Select</button>
                    </div>
                    <button onClick={clearVault} className="w-full py-3 rounded-lg border border-red-500/10 text-red-500/40 hover:text-red-500 hover:bg-red-500/5 text-[9px] font-bold uppercase tracking-widest transition-all">Desync / Clear Vault</button>
                  </div>
                )}
                {session ? (
                  <button onClick={async () => { await clearLibraryFromDB(); setLibrary([]); signOut(); }} className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-red-400 hover:text-red-600 transition-colors w-full text-left"><LogOut className="w-3.5 h-3.5" /> Disconnect</button>
                ) : (
                  <button onClick={() => signIn('spotify')} className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-blue-500 hover:text-blue-700 transition-colors w-full text-left"><LogIn className="w-3.5 h-3.5" /> Connect Spotify</button>
                )}
              </div>
            </div>
          </nav>

          <div className="p-10 text-[10px] font-medium uppercase tracking-[0.3em] opacity-20 text-center">MMXXVI</div>
        </div>
      </aside>

      <AnimatePresence>
        {isSelectionModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-0">
            <motion.div initial={{ scale: 1.02, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.02, opacity: 0 }} className="w-full h-full flex flex-col overflow-hidden">
              <div className="p-10 lg:p-16 border-b border-foreground/5 flex justify-between items-center bg-background/50 backdrop-blur-md sticky top-0 z-20">
                <div className="space-y-2"><h3 className="text-4xl lg:text-5xl font-light tracking-widest uppercase">Selective Indexing</h3><p className="text-xs font-bold opacity-30 uppercase tracking-[0.3em]">Pick covers to add to your neural archive</p></div>
                <button onClick={() => setIsSelectionModalOpen(false)} className="p-6 rounded-full hover:bg-foreground/5 transition-all"><X className="w-10 h-10 opacity-40" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 lg:p-20 custom-scrollbar">
                {isFetchingSelectable ? (
                  <div className="flex flex-col items-center justify-center h-full gap-8"><Loader2 className="w-16 h-16 animate-spin opacity-20" /><p className="text-xs font-bold opacity-20 uppercase tracking-[0.4em]">Accessing Spotify Vault...</p></div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-8 lg:gap-12">
                    {selectableAlbums.map((a) => {
                      const isAlreadySynced = !!library.find(l => l.id === a.album.id);
                      const isSelected = selectedAlbumIds.has(a.album.id);
                      return (
                        <div key={a.album.id} onClick={() => { if (isAlreadySynced) return; const next = new Set(selectedAlbumIds); if (next.has(a.album.id)) next.delete(a.album.id); else next.add(a.album.id); setSelectedAlbumIds(next); }} className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer group transition-all duration-700 border-2 ${isAlreadySynced ? 'border-transparent opacity-20 grayscale cursor-not-allowed' : isSelected ? 'border-accent ring-8 ring-accent/10 scale-95' : 'border-transparent hover:border-foreground/20 hover:scale-[1.02]'}`}>
                          <img src={a.album.images[0]?.url} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6"><p className="text-[10px] font-bold uppercase text-white tracking-widest leading-tight mb-1">{a.album.name}</p><p className="text-[8px] text-white/60 uppercase tracking-widest truncate">{a.album.artists[0].name}</p></div>
                          {isAlreadySynced && <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md rounded-full p-2 border border-foreground/10"><CheckCircle2 className="w-4 h-4 text-accent" /></div>}
                          {isSelected && !isAlreadySynced && <div className="absolute top-4 right-4 bg-accent rounded-full p-2 shadow-xl"><Plus className="w-4 h-4 text-background" /></div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-10 lg:p-16 border-t border-foreground/5 bg-background/50 backdrop-blur-md flex justify-between items-center sticky bottom-0 z-20">
                <div className="flex flex-col gap-2"><div className="text-xl font-light tracking-[0.2em] uppercase">{selectedAlbumIds.size} <span className="opacity-30">Selected</span></div><div className="text-[9px] font-bold opacity-20 uppercase tracking-[0.4em]">Ready for neural synthesis</div></div>
                <div className="flex gap-6"><button onClick={() => setSelectedAlbumIds(new Set())} className="px-10 py-5 rounded-xl border border-foreground/5 text-xs font-bold uppercase tracking-widest hover:bg-foreground/5 transition-all">Clear Selection</button><button onClick={startSelectiveSync} disabled={selectedAlbumIds.size === 0} className="px-16 py-5 rounded-xl bg-accent text-background text-xs font-bold uppercase tracking-widest hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-20 shadow-2xl shadow-accent/20">Synthesize Retrieval</button></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`flex-1 flex flex-col relative overflow-y-auto transition-all duration-700 ${sidebarOpen ? '' : 'bg-background/20 lg:px-12'}`}>
        {!sidebarOpen && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-accent/5 blur-[150px] rounded-full" />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-accent/5 blur-[150px] rounded-full" />
          </div>
        )}

        <header className={`sticky top-0 z-40 flex items-center px-12 justify-between transition-all duration-500 ${sidebarOpen ? 'h-24' : 'h-16 bg-background/50 backdrop-blur-xl border-b border-foreground/5'}`}>
          <div className="flex items-center gap-8">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-full hover:bg-foreground/5 transition-all relative group ${!sidebarOpen ? 'scale-90 opacity-40 hover:opacity-100 hover:scale-100' : ''}`}>
              {isSyncing && <div className="absolute inset-0 rounded-full border border-accent/30 animate-pulse scale-150" />}
              <Layout className={`w-4 h-4 transition-all ${isSyncing ? 'text-accent' : 'opacity-60'}`} />
            </button>
            <span className={`font-black uppercase tracking-[0.3em] text-[9px] transition-all duration-500 ${sidebarOpen ? 'opacity-30' : 'opacity-10 scale-90'}`}>
              {sidebarOpen ? 'Workspace' : 'Focused Archive'} / {view.toUpperCase()}
            </span>
          </div>
          <div className="flex gap-4 items-center">
            {!sidebarOpen && (
              <div className="flex items-center gap-8 mr-12 animate-in fade-in slide-in-from-top-4 duration-700">
                 <div className="flex flex-col items-end"><span className="text-[8px] font-black tracking-[0.4em] opacity-30 uppercase leading-none">Perspective</span><span className="text-[10px] font-light tracking-[0.1em] text-accent uppercase">{libraryView === 'map' ? 'Neural Matrix' : libraryView.toUpperCase()}</span></div>
                 <div className="h-8 w-px bg-foreground/10" />
                 <div className="flex flex-col items-start gap-1"><span className="text-[8px] font-black tracking-[0.4em] opacity-30 uppercase leading-none">Immersive Mode</span><div className="flex gap-1">{[1,2,3].map(i => (<motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} className="w-1 h-1 rounded-full bg-accent" />))}</div></div>
              </div>
            )}
            <div className="flex bg-foreground/5 p-1 rounded-full border border-foreground/5 mr-4 hover:bg-foreground/10 transition-colors">
              {[ { id: 'light', icon: Sun, label: 'Day' }, { id: 'dark', icon: Moon, label: 'Night' }, { id: 'system', icon: Monitor, label: 'Auto' } ].map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id as any)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all group relative ${theme === t.id ? 'bg-background shadow-sm opacity-100' : 'opacity-30 hover:opacity-100'}`}><t.icon className={`w-3.5 h-3.5 ${theme === t.id ? 'text-accent' : ''}`} />{theme === t.id && (<motion.span layoutId="active-theme-text" className="text-[8px] font-black uppercase tracking-[0.2em] leading-none pr-1">{t.label}</motion.span>)}</button>
              ))}
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-foreground/5" /><div className="h-1.5 w-1.5 rounded-full bg-foreground/10" /><div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
          </div>
        </header>

        <div className={`flex-1 p-12 lg:pt-12 space-y-24 transition-all duration-700 ${sidebarOpen ? 'max-w-7xl mx-auto w-full lg:px-24' : 'max-w-full w-full lg:px-12'}`}>
          {view === 'landing' && (
            <div className="space-y-24 animate-in">
              <div className="space-y-4">
                <div className="h-48 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    <motion.h1 
                      key={taglineIndex}
                      initial={{ y: 60, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -60, opacity: 0 }}
                      transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                      className="bauhaus-h1 !font-light tracking-tight absolute inset-0 whitespace-nowrap"
                    >
                      {taglines[taglineIndex]}
                    </motion.h1>
                  </AnimatePresence>
                </div>
                <p className="text-xs uppercase tracking-[0.4em] opacity-20 font-bold">Visual Retrieval Engine</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleInitialIdentify(); }} className="grid grid-cols-1 lg:grid-cols-12 gap-20 items-start">
                <div className="lg:col-span-8 space-y-12">
                  <div className="space-y-4"><div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30">Describe what you remember</div><textarea value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInitialIdentify(); } }} placeholder="COLORS, MOODS, VAGUE SHAPES..." className="w-full text-4xl lg:text-5xl font-light bg-transparent border-none outline-none resize-none placeholder:text-foreground/10 leading-tight" /></div>
                  <button type="submit" disabled={!query.trim() || isProcessing} className="elegant-button px-12 py-6 group"><span className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">Start Search <ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-1 transition-transform" /></span></button>
                </div>
                <div className="lg:col-span-4 space-y-12"><div className="w-full aspect-square glass-card flex items-center justify-center p-12"><div className="w-full h-full rounded-full border border-foreground/5 relative animate-pulse"><div className="absolute inset-8 rounded-full border border-foreground/10" /><div className="absolute inset-16 rounded-full border border-foreground/20" /></div></div><p className="font-medium text-[10px] uppercase tracking-widest leading-relaxed opacity-40 italic">Articulate uses memory mapping to help you find album covers through visual intuition rather than keywords.</p></div>
              </form>
            </div>
          )}

          {(view === 'identifying' || isProcessing) && view !== 'result' && (
            <div className="space-y-16 animate-in py-12">
               <div className="flex flex-col items-center justify-center gap-12 text-center py-24"><div className="relative"><div className="w-24 h-24 rounded-full border border-foreground/5 border-t-foreground/40 animate-spin" /><div className="absolute inset-4 rounded-full border border-foreground/5 border-b-foreground/20 animate-spin [animation-duration:3s]" /></div><h2 className="text-xl font-light tracking-widest uppercase">Consulting Memory</h2></div>
               {localMatches.length > 0 && (
                 <div className="space-y-12 pt-12 border-t border-foreground/5">
                    <div className="flex items-center gap-4"><div className="h-[1px] flex-1 bg-foreground/5" /><h3 className="font-bold uppercase tracking-[0.3em] text-[10px] opacity-30 px-4">Instant Match</h3><div className="h-[1px] flex-1 bg-foreground/5" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">{localMatches.map((match, i) => (<div key={i} onClick={() => { setCandidates([match]); setView('result'); }} className="glass-card p-4 group cursor-pointer border-transparent hover:border-foreground/5"><div className="aspect-square rounded-lg mb-6 overflow-hidden"><img src={match.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /></div><p className="font-medium uppercase truncate text-xs tracking-wider mb-1">{match.title}</p><p className="font-medium uppercase text-[9px] tracking-[0.2em] opacity-40">{match.artist}</p></div>))}</div>
                 </div>
               )}
            </div>
          )}

          {view === 'questioning' && !isProcessing && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-20 animate-in">
              <div className="lg:col-span-8 space-y-16">
                <div className="space-y-4"><div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-30">Clue {history.length + 1}</div><h1 className="bauhaus-h1 !font-light leading-tight">{currentQuestion}</h1></div>
                <div className="space-y-20">
                  <input type="text" autoFocus placeholder="TYPE TO ARTICULATE..." className="w-full text-4xl lg:text-5xl font-light bg-transparent border-none outline-none placeholder:text-foreground/5" onKeyDown={(e) => { if (e.key === 'Enter') { handleAnswer((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                  <div className="space-y-12 border-t border-foreground/5 pt-16">
                    <div className="space-y-10">
                      <div className="flex gap-8 group"><div className="flex flex-col items-center gap-2"><div className="w-6 h-6 rounded-full border border-foreground/10 flex items-center justify-center text-[10px] font-black opacity-20">0</div><div className="w-px flex-1 bg-foreground/5" /></div><div className="space-y-2 pb-8"><span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-10 group-hover:opacity-30 transition-opacity">Initial Memory Anchor</span><p className="font-light text-2xl tracking-wide opacity-40 italic leading-snug">&quot;{query}&quot;</p></div></div>
                      {history.map((h, i) => (<div key={i} className="flex gap-8 group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 0.1}s` }}><div className="flex flex-col items-center gap-2"><div className="w-6 h-6 rounded-full border border-accent/20 flex items-center justify-center text-[10px] font-black text-accent opacity-40">{i + 1}</div>{i < history.length - 1 && <div className="w-px flex-1 bg-foreground/5" />}</div><div className="space-y-3 pb-8"><span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-20 group-hover:opacity-40 transition-opacity">{h.q}</span><div className="flex items-center gap-4"><div className="h-px w-6 bg-accent/40" /><span className="font-light text-2xl tracking-wide text-foreground/80">{h.a}</span></div></div></div>))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 space-y-12">
                <div className="flex items-center justify-between px-1"><span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-30">Contenders</span><span className="text-[10px] font-mono opacity-20">{candidates.length} MATCHES</span></div>
                <div className="grid grid-cols-2 gap-4 relative">
                  <AnimatePresence mode="popLayout">
                    {candidates.slice(0, 4).map((album, idx) => (
                      <motion.div key={album.id || album.title} initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.5, filter: 'blur(10px)' }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: idx * 0.1 }} className="aspect-square glass-card p-1.5 overflow-hidden group cursor-pointer" onClick={() => { setCandidates([album]); setView('result'); }}><div className="w-full h-full rounded-lg overflow-hidden relative"><img src={album.image_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4"><p className="text-[8px] font-bold uppercase text-white tracking-widest leading-tight truncate">{album.title}</p><p className="text-[7px] text-white/60 uppercase tracking-tighter truncate">{album.artist}</p></div></div></motion.div>
                    ))}
                  </AnimatePresence>
                  {candidates.length > 4 && <div className="absolute -bottom-6 right-0 text-[9px] font-bold opacity-10 uppercase tracking-widest">+ {candidates.length - 4} others</div>}
                </div>
                <div className="glass-card p-6 border-accent/10 bg-accent/5"><div className="flex gap-4 items-start"><Sparkles className="w-4 h-4 text-accent mt-1" /><div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Refining Search</p><p className="text-[9px] leading-relaxed opacity-40 uppercase">The engine is isolating unique visual features from {candidates.length} potential covers.</p></div></div></div>
              </div>
            </div>
          )}

          {view === 'result' && (
            <div className="fixed inset-0 z-[150] bg-background animate-in fade-in duration-1000 overflow-y-auto custom-scrollbar">
              {/* Apple-style Moving Gradient Background */}
              <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1.1, 1],
                    rotate: [0, 90, 180, 270, 360],
                    x: ['-10%', '10%', '5%', '-5%'],
                    y: ['-5%', '5%', '10%', '-10%']
                  }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute top-[-20%] left-[-20%] w-[100%] h-[100%] rounded-full blur-[120px] opacity-40"
                  style={{ backgroundColor: resultColors.primary }}
                />
                <motion.div 
                  animate={{ 
                    scale: [1.2, 1, 1.1, 1.2],
                    rotate: [360, 270, 180, 90, 0],
                    x: ['10%', '-10%', '-5%', '5%'],
                    y: ['10%', '-10%', '-5%', '5%']
                  }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full blur-[100px] opacity-30"
                  style={{ backgroundColor: resultColors.soft }}
                />
              </div>

              <div className="relative z-10 max-w-screen-2xl mx-auto p-12 lg:p-24 space-y-24">
                <div className="flex flex-col md:flex-row justify-between items-end gap-12">
                  <div className="space-y-4">
                    <h1 className="bauhaus-h1 !font-light tracking-tight">Match <span className="text-fluid-gradient !font-medium">Found.</span></h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-30">Neural verification successful</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={reset} className="elegant-button px-12 py-5 border-foreground/20 bg-foreground/5 backdrop-blur-xl">New Search</button>
                  </div>
                </div>

                <div className="space-y-32">
                  {candidates.slice(0, 1).map((album, idx) => (
                    <div key={idx} className="grid grid-cols-1 lg:grid-cols-12 gap-24 items-start">
                      {/* Visual Evidence */}
                      <div className="lg:col-span-5 space-y-12">
                        <div className="aspect-square w-full rounded-[48px] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.6)] border border-white/10 relative group">
                          <img src={album.image_url} alt="" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                          <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
                             <div className="space-y-2">
                               <div className="w-10 h-1 bg-accent" />
                               <p className="text-[10px] font-black text-accent uppercase tracking-[0.4em]">Primary Content</p>
                             </div>
                             <Target className="w-10 h-10 text-accent opacity-40" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => {
                              if (album.spotify_uri) {
                                window.open(album.spotify_uri, '_blank');
                              } else if (album.spotify_url) {
                                window.open(album.spotify_url, '_blank');
                              }
                            }}
                            className="flex items-center justify-center gap-4 py-6 bg-foreground text-background rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                          >
                            <Play className="w-4 h-4 fill-background" /> Listen Now
                          </button>
                          <button 
                            onClick={async () => {
                              if (!album.image_url) return;
                              const response = await fetch(album.image_url);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `${album.title.replace(/\s+/g, '_')}_Articulate.jpg`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                              showNotification("ARTWORK DOWNLOADED");
                            }}
                            className="flex items-center justify-center gap-4 py-6 bg-white/5 border border-white/10 text-foreground rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all backdrop-blur-xl"
                          >
                            <ImageIcon className="w-4 h-4" /> Save Art
                          </button>
                        </div>
                      </div>

                      {/* Retrieval Process Analysis */}
                      <div className="lg:col-span-7 space-y-16">
                        <div className="space-y-4">
                          <h2 className="text-6xl lg:text-8xl font-light tracking-tighter leading-none" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>{album.title}</h2>
                          <p className="text-2xl font-medium text-accent tracking-widest uppercase opacity-80">{album.artist}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                          {/* User Input Column */}
                          <div className="space-y-8">
                             <div className="flex items-center gap-4">
                               <div className="w-8 h-px bg-foreground/10" />
                               <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Your Clues</span>
                             </div>
                             <div className="space-y-6">
                                <div className="p-8 rounded-[40px] bg-foreground/[0.03] border border-foreground/5 italic backdrop-blur-xl">
                                   <p className="text-base opacity-70 leading-relaxed">&quot;{query}&quot;</p>
                                </div>
                                {history.map((h, i) => (
                                  <div key={i} className="flex gap-4 items-start pl-6 border-l-2 border-accent/20">
                                     <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0 shadow-[0_0_10px_rgba(212,175,55,0.4)]" />
                                     <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{h.a}</p>
                                  </div>
                                ))}
                             </div>
                          </div>

                          {/* Model Analysis Column */}
                          <div className="space-y-8">
                             <div className="flex items-center gap-4">
                               <div className="w-8 h-px bg-accent/30" />
                               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent/80">Neural Memory</span>
                             </div>
                             <div className="space-y-8">
                                <div className="p-10 rounded-[40px] bg-accent/5 border border-accent/10 backdrop-blur-xl shadow-inner">
                                   <p className="text-base font-medium leading-relaxed tracking-wide text-foreground/90">&quot;{album.visualDescription}&quot;</p>
                                </div>
                                {album.tags && (
                                  <div className="flex flex-wrap gap-3 pl-2">
                                     {[album.tags.mood, album.tags.style, album.tags.composition].map((tag, i) => (
                                       <span key={i} className="text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2.5 bg-foreground/5 border border-foreground/5 rounded-full opacity-60 backdrop-blur-xl">#{tag}</span>
                                     ))}
                                  </div>
                                )}
                             </div>
                          </div>
                        </div>

                        <div className="pt-16 border-t border-foreground/5">
                           <div className="flex items-center gap-8 p-10 bg-foreground/[0.02] rounded-[32px] border border-foreground/5 backdrop-blur-md">
                              <Sparkles className="w-8 h-8 text-accent opacity-60 animate-pulse" />
                              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 leading-relaxed italic max-w-xl">
                                 The engine verified this match by correlating your visual clues with the 384-dimensional spatial embeddings stored in your local archive.
                              </p>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'library' && (
            <div className="space-y-16 animate-in">
              <div className="flex flex-col lg:flex-row justify-between items-end gap-12">
                <div className="space-y-4">
                  <h1 className="bauhaus-h1 !font-light tracking-tight">Visual <span className="text-fluid-gradient !font-medium">Archive.</span></h1>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-20">Stored Collective Memory</p>
                </div>
                <div className="flex p-1 bg-foreground/5 rounded-full backdrop-blur-sm">
                  {[ 
                    { id: 'grid', label: 'GRID', icon: Layout }, 
                    { id: 'dna', label: 'DNA', icon: Zap }, 
                    { id: 'map', label: 'MAP', icon: Globe } 
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setLibraryView(tab.id as any)} className={`px-6 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${libraryView === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}>{tab.label}</button>
                  ))}
                </div>
              </div>
              <div className="min-h-[600px] pt-12">
                {libraryView === 'grid' && <AlbumGrid covers={library as unknown as CoverObject[]} />}
                {libraryView === 'dna' && <div className="max-w-4xl mx-auto"><VisualDNADashboard covers={library as unknown as CoverObject[]} /></div>}
                {libraryView === 'map' && <SemanticMap covers={library as unknown as CoverObject[]} />}
              </div>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {isSyncing && (
          <motion.div key="sync-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-24 bg-background/40 backdrop-blur-[32px]">
            <motion.div layoutId="sync-panel" className="w-full max-w-6xl min-h-[600px] lg:min-h-[750px] glass-card border-white/10 shadow-2xl relative overflow-hidden flex flex-col transition-colors duration-1000" style={{ background: `linear-gradient(135deg, ${currentSyncColors.soft} 0%, rgba(255,255,255,0.01) 100%)` }}>
              <div className="absolute inset-0 -z-10 overflow-hidden"><motion.div animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -30, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 blur-[120px] rounded-full transition-colors duration-1000" style={{ backgroundColor: currentSyncColors.primary, opacity: 0.1 }} /><motion.div animate={{ scale: [1.2, 1, 1.2], x: [0, -40, 0], y: [0, 60, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 blur-[120px] rounded-full transition-colors duration-1000" style={{ backgroundColor: currentSyncColors.primary, opacity: 0.05 }} /></div>
              <div className="p-10 flex justify-between items-center shrink-0"><div className="flex items-center gap-6"><div className="w-2 h-2 rounded-full animate-pulse transition-colors duration-1000" style={{ backgroundColor: currentSyncColors.primary }} /><div className="space-y-1"><span className="block font-bold text-[10px] uppercase tracking-[0.4em] opacity-40 leading-none">Neural Synthesis</span><span className="block text-[8px] font-medium opacity-20 uppercase tracking-widest">{syncStatus === 'indexing' ? `Calibrating ${currentSyncIndex + 1} / ${albumsToSync.length}` : 'Initializing'}</span></div></div><div className="flex gap-4"><button onClick={() => setIsSyncMinimized(true)} className="p-3 rounded-full hover:bg-foreground/5 opacity-40 hover:opacity-100 transition-all"><Minimize2 className="w-5 h-5" /></button><button onClick={() => setIsPaused(!isPaused)} className="p-3 rounded-full hover:bg-foreground/5 opacity-40 hover:opacity-100 transition-all">{isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}</button><button onClick={stopSync} className="p-3 rounded-full hover:bg-foreground/5 opacity-40 hover:opacity-100 transition-all"><X className="w-5 h-5" /></button></div></div>
              <div className="flex-1 flex items-center justify-center px-12 relative">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center w-full max-w-5xl">
                  <div className="lg:col-span-6 flex justify-center"><div className="relative group"><div className="absolute inset-0 bg-accent/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 scale-110" /><div className="relative w-full aspect-square max-w-[440px] rounded-[32px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.4)] border border-white/10"><AnimatePresence mode="wait"><motion.img key={library[galleryIndex]?.id || 'loading'} initial={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }} src={library[galleryIndex]?.image_url || albumsToSync[currentSyncIndex]?.album?.images[0]?.url} className="w-full h-full object-cover" alt="" /></AnimatePresence></div></div></div>
                  <div className="lg:col-span-6 space-y-12"><div className="space-y-6"><motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={library[galleryIndex]?.id || 'processing'} className="space-y-4"><h2 className="text-5xl lg:text-6xl font-light tracking-tight leading-tight text-foreground">{library[galleryIndex]?.title || 'Processing...'}</h2><p className="text-xl font-medium text-accent tracking-widest uppercase opacity-80">{library[galleryIndex]?.artist || 'Synthesizing Neural Data'}</p></motion.div><div className="h-[1px] w-24 bg-accent/20" /><p className="text-xs font-medium uppercase tracking-[0.2em] leading-relaxed opacity-40 italic max-w-sm">&quot;{library[galleryIndex]?.visualDescription || syncSubText}&quot;</p></div><div className="space-y-8"><div className="flex justify-between items-end"><div className="text-8xl font-light tracking-tighter tabular-nums text-foreground">{syncProgress}%</div><div className="flex gap-4 pb-4"><button onClick={() => setGalleryIndex(prev => Math.min(library.length - 1, prev + 1))} disabled={galleryIndex >= library.length - 1} className="w-12 h-12 rounded-full border border-foreground/10 flex items-center justify-center hover:bg-foreground/5 disabled:opacity-10 transition-all"><ChevronLeft className="w-5 h-5" /></button><button onClick={() => setGalleryIndex(prev => Math.max(0, prev - 1))} disabled={galleryIndex === 0} className="w-12 h-12 rounded-full border border-foreground/10 flex items-center justify-center hover:bg-foreground/5 disabled:opacity-10 transition-all"><ChevronRight className="w-5 h-5" /></button></div></div><div className="h-1 bg-foreground/5 rounded-full overflow-hidden"><motion.div className="h-full transition-colors duration-1000" style={{ backgroundColor: currentSyncColors.primary }} animate={{ width: `${syncProgress}%` }} transition={{ duration: 1, ease: "circOut" }} /></div></div></div>
                </div>
              </div>
              <div className="h-32 border-t border-white/5 px-10 flex items-center gap-4 overflow-x-auto custom-scrollbar shrink-0"><div className="flex gap-4">{library.slice(-20).reverse().map((item, i) => (<motion.div key={`${item.id}-${i}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} onClick={() => setGalleryIndex(library.indexOf(item))} className={`w-16 h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-500 border-2 ${library.indexOf(item) === galleryIndex ? 'border-accent scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}><img src={item.image_url} className="w-full h-full object-cover" alt="" /></motion.div>))}{syncStatus === 'indexing' && (<div className="w-16 h-16 rounded-xl border border-dashed border-accent/30 flex items-center justify-center bg-accent/5 animate-pulse"><RotateCcw className="w-4 h-4 opacity-20 animate-spin" /></div>)}</div></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
