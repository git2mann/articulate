'use client';

import { CoverObject } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useRef } from 'react';
import { Info, X, Zap, Maximize2, Minimize2, Sparkles, Target, Layers, ArrowLeft, ExternalLink, Play, Search, Hash } from 'lucide-react';
import { findSimilarCovers, computeCosineSimilarity } from '@/lib/embeddings';

interface VisualGraphProps {
  covers: CoverObject[];
}

type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;

export default function SemanticMap({ covers }: VisualGraphProps) {
  const [showInsight, setShowInsight] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isConstellationExpanded, setIsConstellationExpanded] = useState(false);
  const [isolatedQuadrant, setIsolatedQuadrant] = useState<Quadrant>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Neural Plotting Logic (Upgraded for semantic accuracy)
  const points = useMemo(() => {
    if (covers.length === 0) return [];
    
    const anchor = covers[0];
    if (!anchor.embedding) {
      return covers.map((c, idx) => ({
        cover: c,
        x: c.tags?.brightness === 'bright' ? 70 : 30,
        y: c.tags?.composition === 'scattered' ? 75 : 25,
        quadrant: (c.tags?.brightness === 'bright' ? 'top-right' : 'bottom-left') as Quadrant,
        uniqueKey: `${c.cover_id || idx}-${idx}`
      }));
    }

    return covers.map((c, idx) => {
      if (!c.embedding) return { cover: c, x: 50, y: 50, quadrant: 'top-left' as Quadrant, uniqueKey: `${idx}` };
      const xScore = computeCosineSimilarity(c.embedding, anchor.embedding);
      const yScore = (c.tags?.composition === 'scattered' ? 0.8 : 0.2) * 0.4 + (xScore * 0.6);
      const id = c.cover_id || (c as any).id || idx.toString();
      const jitter = (parseInt(id.substring(0, 1), 16) || 0) % 5;
      const x = Math.min(Math.max((xScore * 80) + 10 + jitter, 8), 92);
      const y = Math.min(Math.max((yScore * 80) + 10 - jitter, 8), 92);

      let quadrant: Quadrant = 'bottom-left';
      if (x >= 50 && y >= 50) quadrant = 'top-right';
      else if (x < 50 && y >= 50) quadrant = 'top-left';
      else if (x >= 50 && y < 50) quadrant = 'bottom-right';

      return { cover: c, x, y, quadrant, uniqueKey: `${c.cover_id || idx}-${idx}` };
    });
  }, [covers]);

  const activePoint = points.find(p => p.uniqueKey === (selectedId || hoveredId));
  const selectedPoint = points.find(p => p.uniqueKey === selectedId);
  
  const similarPoints = useMemo(() => {
    if (!selectedPoint) return [];
    const count = isConstellationExpanded ? 12 : 5;
    const similar = findSimilarCovers(selectedPoint.cover, covers, count);
    return points
      .filter(p => {
        const pId = p.cover.cover_id || (p.cover as any).id;
        return similar.some(s => (s.cover_id || (s as any).id) === pId);
      })
      .map(p => ({
        ...p,
        similarityScore: computeCosineSimilarity(selectedPoint.cover.embedding, p.cover.embedding)
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore);
  }, [selectedId, points, covers, isConstellationExpanded]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: 100 - ((e.clientY - rect.top) / rect.height) * 100
    });
  };

  const handlePointClick = (id: string) => {
    setSelectedId(selectedId === id ? null : id);
  };

  const toggleIsolation = (q: Quadrant) => {
    setIsolatedQuadrant(isolatedQuadrant === q ? null : q);
    setSelectedId(null);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-[850px] bg-background rounded-[48px] border border-foreground/5 overflow-hidden flex flex-col shadow-2xl"
    >
      {/* 0. AMBIENT ATMOSPHERE */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" 
             style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
        <motion.div 
          animate={{ x: (mousePos.x - 50) * 0.5, y: (mousePos.y - 50) * -0.5 }}
          className="absolute inset-0 bg-gradient-radial from-accent/5 to-transparent blur-[120px]" 
        />
      </div>

      {/* 1. INTERACTIVE AXIS OVERLAY */}
      <div className="absolute inset-0 pointer-events-none px-20 pb-20">
         <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-foreground/10 to-transparent" />
         <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
         
         <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <span className="text-[9px] font-black text-foreground/20 uppercase tracking-[0.6em]">Structural Density</span>
            <div className="w-px h-12 bg-gradient-to-b from-accent/40 to-transparent" />
         </div>

         <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="w-px h-12 bg-gradient-to-t from-accent/40 to-transparent" />
            <span className="text-[9px] font-black text-foreground/20 uppercase tracking-[0.6em]">Minimalist Void</span>
         </div>

         <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-4 rotate-90 origin-right">
            <span className="text-[9px] font-black text-foreground/20 uppercase tracking-[0.6em]">Vibrant Chroma</span>
            <div className="h-px w-12 bg-gradient-to-r from-accent/40 to-transparent" />
         </div>

         <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center gap-4 -rotate-90 origin-left">
            <span className="text-[9px] font-black text-foreground/20 uppercase tracking-[0.6em]">Noir Luminance</span>
            <div className="h-px w-12 bg-gradient-to-r from-accent/40 to-transparent" />
         </div>
      </div>

      {/* 2. HEADER & CONTROL SYSTEM */}
      <div className="p-12 z-40 flex justify-between items-start pointer-events-none">
        <div className="space-y-3 pointer-events-auto">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center shadow-xl">
                <Hash className="w-5 h-5 text-background" />
             </div>
             <div>
                <h3 className="text-3xl font-light text-foreground tracking-tighter uppercase leading-none" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>Visual Matrix</h3>
                <p className="text-[9px] font-black text-accent uppercase tracking-[0.5em] mt-1">Neural Mapping Layer</p>
             </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setShowInsight(true)} className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 rounded-full transition-all group">
              <Info className="w-3.5 h-3.5 opacity-40 group-hover:text-accent transition-colors" />
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Logic</span>
            </button>
            {isolatedQuadrant && (
              <button onClick={() => toggleIsolation(null)} className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-full transition-all group">
                <ArrowLeft className="w-3.5 h-3.5 text-accent" />
                <span className="text-[8px] font-bold text-accent uppercase tracking-widest">Global View</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Status HUD */}
        <AnimatePresence>
          {activePoint && !selectedId && (
             <motion.div 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               className="pointer-events-auto flex items-center gap-8 glass-card px-10 py-6 border-white/5 shadow-2xl"
             >
               <div className="text-right space-y-1">
                  <p className="text-xl font-light text-foreground uppercase tracking-tight leading-none" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>{activePoint.cover.album_name}</p>
                  <div className="flex items-center justify-end gap-3 opacity-40 uppercase font-black text-[9px] tracking-widest">
                    <span>{activePoint.cover.artist}</span>
                    <div className="w-1 h-1 rounded-full bg-accent" />
                    <span>{activePoint.cover.tags?.brightness}</span>
                  </div>
               </div>
               <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-lg rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <img src={activePoint.cover.image_url} className="w-full h-full object-cover" alt="" />
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. NEURAL POINTS LAYER */}
      <div className="relative flex-1 px-20 pb-20 overflow-hidden">
        <div className="relative w-full h-full">
          {points.map((p) => {
            const isSelected = selectedId === p.uniqueKey;
            const isSimilar = similarPoints.some(sp => sp.uniqueKey === p.uniqueKey);
            const isDimmed = (selectedId !== null && !isSelected && !isSimilar) || (isolatedQuadrant && isolatedQuadrant !== p.quadrant);
            
            let displayX = p.x;
            let displayY = p.y;
            if (isolatedQuadrant && p.quadrant) {
              const xMin = p.quadrant.includes('left') ? 0 : 50;
              const yMin = p.quadrant.includes('bottom') ? 0 : 50;
              displayX = ((p.x - xMin) / 50) * 70 + 15;
              displayY = ((p.y - yMin) / 50) * 70 + 15;
            }

            return (
              <motion.div
                key={p.uniqueKey}
                className="absolute cursor-pointer"
                layout
                transition={{ type: 'spring', damping: 30, stiffness: 100 }}
                style={{ left: `${displayX}%`, bottom: `${displayY}%`, transform: 'translate(-50%, 50%)', zIndex: isSelected ? 40 : (isSimilar ? 30 : 10) }}
                animate={{ 
                  scale: isSelected ? 1.4 : (isSimilar ? 1.2 : 1),
                  opacity: isDimmed ? 0.05 : 1,
                  filter: isDimmed ? 'blur(8px) grayscale(1)' : 'blur(0px) grayscale(0)'
                }}
                onMouseEnter={() => setHoveredId(p.uniqueKey)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handlePointClick(p.uniqueKey)}
              >
                {/* PROXIMITY RIPPLE */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.8, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute -inset-4 rounded-[28px] border border-accent/30 bg-accent/5 z-[-1]"
                    />
                  )}
                </AnimatePresence>

                <div className={`w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border transition-all duration-700 ${isSelected ? 'border-accent ring-8 ring-accent/10 shadow-[0_0_60px_rgba(212,175,55,0.4)]' : (isSimilar ? 'border-accent/30' : 'border-white/10 hover:border-white/30')}`}>
                  <img src={p.cover.image_url} alt="" className="w-full h-full object-cover transition-transform duration-1000 hover:scale-110" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 4. DEEP ANALYSIS HUD */}
      <AnimatePresence>
        {selectedPoint && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
            className="absolute top-8 right-8 bottom-8 w-[500px] glass-card border-white/5 z-50 p-12 flex flex-col shadow-[-40px_0_100px_rgba(0,0,0,0.4)] overflow-hidden"
          >
            {/* HUD BG ELEMENTS */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[100px] -z-10" />
            
            <div className="flex justify-between items-center mb-12">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40">Neural Diagnostic</span>
               </div>
               <button onClick={() => setSelectedId(null)} className="p-3 hover:bg-foreground/10 rounded-full transition-all">
                 <X className="w-6 h-6 opacity-40" />
               </button>
            </div>

            <div className="flex-1 space-y-12 overflow-y-auto pr-4 custom-scrollbar">
              {/* FEATURED COVER */}
              <div className="space-y-8">
                <div className="aspect-square w-full rounded-[40px] overflow-hidden shadow-2xl border border-white/10 relative group">
                  <img src={selectedPoint.cover.image_url} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-accent uppercase tracking-[0.4em]">Primary Match</p>
                      <h4 className="text-4xl font-light text-foreground uppercase tracking-tighter leading-none" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>{selectedPoint.cover.album_name}</h4>
                      <p className="text-lg font-medium opacity-60 tracking-tight">{selectedPoint.cover.artist}</p>
                    </div>
                    <Target className="w-10 h-10 text-accent opacity-40" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button className="flex items-center justify-center gap-4 py-5 bg-foreground text-background rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl">
                     <Play className="w-4 h-4 fill-background" /> Connect Spotify
                   </button>
                   <button className="flex items-center justify-center gap-4 py-5 bg-white/5 border border-white/10 text-foreground rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
                     <Search className="w-4 h-4" /> Visual Audit
                   </button>
                </div>
              </div>

              {/* SEMANTIC DATA GRID */}
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: 'Atmosphere', val: selectedPoint.cover.tags?.mood, icon: Sparkles },
                   { label: 'Composition', val: selectedPoint.cover.tags?.composition, icon: Layers },
                   { label: 'Intensity', val: selectedPoint.cover.tags?.brightness, icon: Zap },
                   { label: 'Style', val: selectedPoint.cover.tags?.style, icon: Target },
                 ].map((stat, i) => (
                   <div key={i} className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-4 group hover:bg-white/[0.06] transition-colors">
                      <stat.icon className="w-4 h-4 text-accent/60" />
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-foreground/30 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-sm font-medium uppercase tracking-tight">{stat.val}</p>
                      </div>
                   </div>
                 ))}
              </div>

              {/* COLOR DNA */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.3em]">Chromatic Signature</span>
                   <div className="h-px flex-1 mx-6 bg-white/5" />
                </div>
                <div className="flex flex-wrap gap-4">
                  {selectedPoint.cover.tags?.colors.filter(c => c !== 'unknown').map((color, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/5 pl-2 pr-5 py-2 rounded-full hover:bg-white/10 transition-all shadow-lg">
                      <div className="w-6 h-6 rounded-full shadow-inner border border-white/10" style={{ backgroundColor: color }} />
                      <span className="text-[9px] font-black text-foreground/40 uppercase tracking-widest">{color}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PROXIMITY CONSTELLATION */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.3em]">Neural Proximity</span>
                   <button onClick={() => setIsConstellationExpanded(true)} className="text-[9px] font-black text-accent uppercase tracking-widest hover:opacity-100 transition-all opacity-60">Expand Map</button>
                </div>
                
                <div onClick={() => setIsConstellationExpanded(true)} className="relative w-full h-[280px] bg-black/40 border border-white/5 rounded-[40px] overflow-hidden cursor-zoom-in group/const">
                  <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover/const:opacity-100 transition-opacity" />
                  
                  {/* Central Node */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                    <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-accent shadow-[0_0_40px_rgba(212,175,55,0.3)] bg-background scale-110">
                      <img src={selectedPoint.cover.image_url} className="w-full h-full object-cover" alt="" />
                    </div>
                  </div>

                  <svg className="absolute inset-0 w-full h-full z-10 opacity-20">
                    {similarPoints.map((sp, i) => {
                      const angle = (i / similarPoints.length) * Math.PI * 2;
                      const radius = 40 - (sp.similarityScore * 20); 
                      const x = 50 + Math.cos(angle) * radius;
                      const y = 50 + Math.sin(angle) * radius;
                      return (
                        <motion.line key={i} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`} stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 4" />
                      );
                    })}
                  </svg>

                  {similarPoints.map((sp, i) => {
                    const angle = (i / similarPoints.length) * Math.PI * 2;
                    const radius = 40 - (sp.similarityScore * 20);
                    const x = 50 + Math.cos(angle) * radius;
                    const y = 50 + Math.sin(angle) * radius;
                    return (
                      <div key={i} style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }} className="absolute z-20">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05 }} onClick={(e) => { e.stopPropagation(); setSelectedId(sp.uniqueKey); }}
                          className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 hover:border-accent hover:scale-110 transition-all shadow-2xl bg-background"
                        >
                          <img src={sp.cover.image_url} className="w-full h-full object-cover" alt="" />
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. EXPANDED NEURAL WORKSPACE */}
      <AnimatePresence>
        {isConstellationExpanded && selectedPoint && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-background/98 backdrop-blur-3xl flex flex-col p-16">
            <div className="flex justify-between items-start mb-20">
               <div className="space-y-4">
                 <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-[24px] bg-accent/10 flex items-center justify-center border border-accent/20">
                      <Target className="w-8 h-8 text-accent" />
                   </div>
                   <div>
                     <h4 className="text-6xl font-light text-foreground uppercase tracking-tighter" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>Deep Proximity <span className="text-accent font-medium">Analysis</span></h4>
                     <p className="text-[11px] font-black text-foreground/20 uppercase tracking-[0.5em] mt-2">384-Dimensional Semantic Mapping Layer</p>
                   </div>
                 </div>
               </div>
               <button onClick={() => setIsConstellationExpanded(false)} className="flex items-center gap-4 px-10 py-5 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-foreground uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
                 <Minimize2 className="w-5 h-5" /> Terminate Link
               </button>
            </div>

            <div className="flex-1 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                <div className="w-48 h-48 rounded-[56px] overflow-hidden border-4 border-accent shadow-[0_0_100px_rgba(212,175,55,0.3)] bg-background scale-110">
                  <img src={selectedPoint.cover.image_url} className="w-full h-full object-cover" alt="" />
                </div>
              </div>

              <svg className="absolute inset-0 w-full h-full overflow-visible z-10 opacity-30">
                {similarPoints.map((sp, i) => {
                  const angle = (i / similarPoints.length) * Math.PI * 2;
                  const radius = 55 - (sp.similarityScore * 30); 
                  const x = 50 + Math.cos(angle) * radius;
                  const y = 50 + Math.sin(angle) * radius;
                  return (
                    <motion.line key={i} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="8 8" />
                  );
                })}
              </svg>

              {similarPoints.map((sp, i) => {
                const angle = (i / similarPoints.length) * Math.PI * 2;
                const radius = 55 - (sp.similarityScore * 30); 
                const x = 50 + Math.cos(angle) * radius;
                const y = 50 + Math.sin(angle) * radius;
                return (
                  <div key={i} style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }} className="absolute z-20">
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.1, zIndex: 100 }} onClick={() => setSelectedId(sp.uniqueKey)}
                      className="relative cursor-pointer group/macro"
                    >
                      <div className="w-32 h-32 rounded-[32px] overflow-hidden border-2 border-white/10 group-hover/macro:border-accent transition-all shadow-[0_20px_60px_rgba(0,0,0,0.5)] bg-background">
                        <img src={sp.cover.image_url} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center opacity-0 group-hover/macro:opacity-100 transition-all duration-500">
                           <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">{Math.round(sp.similarityScore * 100)}% Match</p>
                           <p className="text-xs font-bold text-foreground text-center px-4 line-clamp-2 uppercase tracking-tighter">{(sp.cover.album_name || (sp.cover as any).title)}</p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto flex justify-between items-end border-t border-white/5 pt-12">
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.4em]">Anchor Reference</p>
                 <p className="text-3xl font-light text-foreground uppercase tracking-tight" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>{selectedPoint.cover.album_name}</p>
                 <p className="text-lg font-medium text-accent tracking-widest uppercase">{selectedPoint.cover.artist}</p>
               </div>
               <div className="max-w-xl text-right">
                 <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.1em] leading-relaxed italic">
                   Semantic proximity analysis utilizes CLIP-Vit-B/32 neural embeddings to project latent visual relationships into Cartesian space. Distance represents the calculated cosine similarity across 384 dimensions of visual, aesthetic, and conceptual data.
                 </p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. SPATIAL LOGIC OVERLAY */}
      <AnimatePresence>
        {showInsight && (
          <motion.div initial={{ opacity: 0, backdropFilter: 'blur(0px)' }} animate={{ opacity: 1, backdropFilter: 'blur(40px)' }} exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="absolute inset-0 z-[150] flex items-center justify-center p-24 text-center bg-background/40"
          >
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="max-w-4xl glass-card p-24 border-white/10 shadow-2xl relative">
              <button onClick={() => setShowInsight(false)} className="absolute top-12 right-12 p-4 rounded-full hover:bg-foreground/10 transition-all opacity-40 hover:opacity-100">
                <X className="w-8 h-8" />
              </button>
              
              <div className="space-y-20">
                <div className="space-y-6">
                  <p className="text-[12px] font-black uppercase tracking-[0.6em] text-accent">Coordinate Protocol</p>
                  <h4 className="text-8xl font-light text-foreground uppercase tracking-tighter leading-none" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>Neural Matrix</h4>
                </div>

                <div className="grid grid-cols-2 gap-20 text-left">
                  <div className="space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[24px] border-2 border-foreground/10 flex items-center justify-center font-light text-4xl">X</div>
                      <span className="text-4xl font-light text-foreground uppercase tracking-tighter" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>Chromaticity</span>
                    </div>
                    <p className="text-foreground/40 font-bold uppercase text-[11px] tracking-widest leading-relaxed italic">
                      Horizontal distribution tracks perceived visual intensity—mapping from moody, deep monochromatic noir to hyper-vibrant saturation gradients.
                    </p>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[24px] border-2 border-accent/20 flex items-center justify-center font-light text-4xl text-accent">Y</div>
                      <span className="text-4xl font-light text-foreground uppercase tracking-tighter" style={{ fontFamily: '"Noto Serif Display Condensed", serif' }}>Density</span>
                    </div>
                    <p className="text-foreground/40 font-bold uppercase text-[11px] tracking-widest leading-relaxed italic">
                      Vertical plotting represents structural entropy—organizing the archives from minimalist, breathing voids to high-complexity, scattered compositions.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
