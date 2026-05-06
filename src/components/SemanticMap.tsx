'use client';

import { CoverObject } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useRef } from 'react';
import { Info, X, Zap, Maximize2, Minimize2, Sparkles, Target, Layers, ArrowLeft, ExternalLink, Play } from 'lucide-react';
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

  // 1. Plotting Logic
  const points = useMemo(() => {
    return covers.map((c, idx) => {
      let x = c.tags?.brightness === 'bright' ? 70 : 30;
      let y = 50;
      if (c.tags?.composition === 'scattered') y = 75;
      if (c.tags?.composition === 'centered' || c.tags?.composition === 'portrait') y = 25;
      if (c.tags?.style === 'abstract') y += 10;
      
      const id = c.cover_id || (c as any).id || idx.toString();
      const jitterX = (parseInt(id.substring(0, 2), 16) || idx) % 30 - 15;
      const jitterY = (parseInt(id.substring(2, 4), 16) || idx) % 30 - 15;

      const finalX = Math.min(Math.max(x + jitterX, 8), 92);
      const finalY = Math.min(Math.max(y + jitterY, 8), 92);

      let quadrant: Quadrant = 'bottom-left';
      if (finalX >= 50 && finalY >= 50) quadrant = 'top-right';
      else if (finalX < 50 && finalY >= 50) quadrant = 'top-left';
      else if (finalX >= 50 && finalY < 50) quadrant = 'bottom-right';

      return {
        cover: c,
        x: finalX,
        y: finalY,
        quadrant,
        uniqueKey: `${c.cover_id || idx}-${idx}`
      };
    });
  }, [covers]);

  // 2. Interaction Data
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

  const handlePointClick = (id: string, quadrant: Quadrant) => {
    if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      // Trigger Similarity Ripple could be a state pulse
    }
  };

  const toggleIsolation = (q: Quadrant) => {
    setIsolatedQuadrant(isolatedQuadrant === q ? null : q);
    setSelectedId(null);
  };

  const hasNoData = covers.length > 0 && covers.every(c => !c.tags || c.tags.colors[0] === 'unknown');

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-[850px] bg-[#020202] rounded-[56px] border border-white/10 overflow-hidden flex flex-col shadow-[0_0_120px_rgba(0,0,0,1)]"
    >
      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: `radial-gradient(#fff 1.5px, transparent 1.5px), linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`, 
                    backgroundSize: '8px 8px, 80px 80px, 80px 80px' }} />
      
      <AnimatePresence>
        {isolatedQuadrant && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-emerald-500/5 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* QUADRANT LABELS */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { id: 'top-left' as Quadrant, label: 'Midnight\nDetail', align: 'items-start justify-start' },
          { id: 'top-right' as Quadrant, label: 'Vibrant\nComplexity', align: 'items-start justify-end text-right' },
          { id: 'bottom-left' as Quadrant, label: 'Noir\nMinimalism', align: 'items-end justify-start' },
          { id: 'bottom-right' as Quadrant, label: 'Pure\nLuminance', align: 'items-end justify-end text-right' }
        ].map((q, i) => (
          <motion.div 
            key={i}
            className={`absolute inset-0 p-16 flex ${q.align}`}
            animate={{ 
              opacity: isolatedQuadrant && isolatedQuadrant !== q.id ? 0 : 1,
              scale: isolatedQuadrant === q.id ? 1.2 : 1,
              x: (mousePos.x - 50) * -0.05,
              y: (mousePos.y - 50) * 0.05
            }}
          >
            <span className="text-[52px] font-black text-white/[0.02] leading-[0.85] uppercase tracking-tighter whitespace-pre italic">
              {q.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* HEADER */}
      <div className="p-12 z-40 flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <motion.div 
               animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="w-2 h-2 bg-emerald-500 rounded-full" 
             />
             <h3 className="text-2xl font-black text-white tracking-tight uppercase">Visual DNA Matrix</h3>
             <button onClick={() => setShowInsight(!showInsight)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <Info className="w-5 h-5 text-emerald-500" />
             </button>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Aesthetic Coordinate Matrix</p>
            {isolatedQuadrant && (
              <button 
                onClick={() => toggleIsolation(null)}
                className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
              >
                <ArrowLeft className="w-3 h-3" /> Reset View
              </button>
            )}
          </div>
        </div>

        {/* TOP STATUS BAR (Dynamic Readout) */}
        <AnimatePresence>
          {activePoint && !selectedId && (
             <motion.div 
               initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="flex items-center gap-8 bg-white/[0.02] backdrop-blur-3xl px-8 py-4 rounded-[24px] border border-white/5 shadow-2xl"
             >
               <div className="text-right">
                  <p className="text-lg font-black text-white uppercase tracking-tight leading-none">{activePoint.cover.album_name}</p>
                  <p className="text-[10px] font-bold text-white/40 uppercase pt-1">{activePoint.cover.artist} // {activePoint.cover.tags?.brightness} • {activePoint.cover.tags?.composition}</p>
               </div>
               <img src={activePoint.cover.image_url} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt="" />
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MAIN GRAPH AREA */}
      <div className="relative flex-1 px-16 pb-16 overflow-hidden">
        
        {/* STRUCTURAL ELEMENTS */}
        <div className="absolute inset-0 pointer-events-none px-16 pb-16">
           {/* Vertical Axis - Restored to full glory */}
           <motion.div 
             animate={{ opacity: isolatedQuadrant ? 0.2 : 0.4 }}
             className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
           />
           <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 px-5 py-1.5 rounded-full border border-white/20 backdrop-blur-xl z-20 shadow-2xl">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Structural Density</span>
           </div>
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-5 py-1.5 rounded-full border border-white/20 backdrop-blur-xl z-20 shadow-2xl">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Minimalist Void</span>
           </div>

           {/* Horizontal Axis */}
           <motion.div 
             animate={{ opacity: isolatedQuadrant ? 0.2 : 0.4 }}
             className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
           />
           <div className="absolute left-14 top-1/2 -translate-y-1/2 -rotate-90 origin-left bg-black/80 px-5 py-1.5 rounded-full border border-white/20 backdrop-blur-xl z-20 shadow-2xl">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Moody Noir</span>
           </div>
           <div className="absolute right-14 top-1/2 -translate-y-1/2 rotate-90 origin-right bg-black/80 px-5 py-1.5 rounded-full border border-white/20 backdrop-blur-xl z-20 shadow-2xl">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Hyper Vibrant</span>
           </div>

           {/* QUADRANT LABELS */}
           {/* (SVG lines removed from here) */}

           {/* Quadrant Interaction Hotspots */}
           {!isolatedQuadrant && (
             <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
               {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((q) => (
                 <div 
                   key={q} 
                   className="group pointer-events-auto cursor-crosshair relative"
                   onClick={() => toggleIsolation(q as Quadrant)}
                 >
                   <div className="absolute inset-4 border border-white/0 group-hover:border-white/5 rounded-3xl transition-all flex items-center justify-center">
                     <Layers className="w-6 h-6 text-white/0 group-hover:text-white/10 transition-all" />
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>

        {/* POINTS LAYER */}
        <div className="relative w-full h-full">
          {points.map((p) => {
            const isSelected = selectedId === p.uniqueKey;
            const isSimilar = similarPoints.some(sp => sp.uniqueKey === p.uniqueKey);
            const isDimmed = (selectedId !== null && !isSelected && !isSimilar) || (isolatedQuadrant && isolatedQuadrant !== p.quadrant);
            
            // Re-calculate position if isolated
            let displayX = p.x;
            let displayY = p.y;
            if (isolatedQuadrant) {
              const xMin = p.quadrant.includes('left') ? 0 : 50;
              const yMin = p.quadrant.includes('bottom') ? 0 : 50;
              displayX = ((p.x - xMin) / 50) * 80 + 10;
              displayY = ((p.y - yMin) / 50) * 80 + 10;
            }

            return (
              <motion.div
                key={p.uniqueKey}
                className="absolute cursor-pointer"
                layout
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                style={{
                  left: `${displayX}%`,
                  bottom: `${displayY}%`,
                  transform: 'translate(-50%, 50%)',
                  // zIndex capped to ensure HUD (z-50) is always on top
                  zIndex: isSelected ? 40 : (isSimilar ? 30 : 10)
                }}
                animate={{ 
                  // Subtler scale to prevent UI "clash"
                  scale: isSelected ? 1.2 : (isSimilar ? 1.3 : 1),
                  opacity: isDimmed ? 0.05 : 1,
                  filter: isDimmed ? 'blur(4px) grayscale(0.9)' : 'blur(0px) grayscale(0)'
                }}
                onMouseEnter={() => setHoveredId(p.uniqueKey)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handlePointClick(p.uniqueKey, p.quadrant)}
              >
                {/* STATUS RING (Replaces inflation as the primary indicator) */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.4, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute -inset-2 rounded-[24px] border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] z-[-1]"
                    />
                  )}
                </AnimatePresence>
                {/* POINT PULSE (Ripple effect) */}
                {isSelected && (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-2xl bg-emerald-500/30"
                  />
                )}

                <div className={`w-14 h-14 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-500 bg-neutral-900 ${isSelected ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.6)]' : (isSimilar ? 'border-indigo-500' : 'border-white/10')}`}>
                  <img src={p.cover.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* IMMERSIVE BLUEPRINT HUD (When Selected) */}
      <AnimatePresence>
        {selectedPoint && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
            className="absolute top-0 right-0 bottom-0 w-[450px] bg-black/80 backdrop-blur-3xl border-l border-white/10 z-50 p-12 flex flex-col shadow-[-50px_0_100px_rgba(0,0,0,0.5)]"
          >
            <button onClick={() => setSelectedId(null)} className="self-end p-3 hover:bg-white/10 rounded-full transition-all mb-8">
              <X className="w-6 h-6 text-white/40" />
            </button>

            <div className="flex-1 space-y-10 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-6">
                <div className="aspect-square w-full rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group">
                  <img src={selectedPoint.cover.image_url} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Neural Match</p>
                      <h4 className="text-2xl font-black text-white uppercase tracking-tight">{selectedPoint.cover.album_name}</h4>
                    </div>
                    <Target className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button className="flex items-center justify-center gap-3 py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all">
                     <Play className="w-3 h-3 fill-black" /> Spotify
                   </button>
                   <button className="flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">
                     <ExternalLink className="w-3 h-3" /> Details
                   </button>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">AI Visual Analysis</p>
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[24px] space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-white/60">Composition</span>
                      <span className="text-[11px] font-black text-emerald-400 uppercase">{selectedPoint.cover.tags?.composition}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-white/60">Luminance</span>
                      <span className="text-[11px] font-black text-emerald-400 uppercase">{selectedPoint.cover.tags?.brightness}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-white/60">Atmosphere</span>
                      <span className="text-[11px] font-black text-emerald-400 uppercase">{selectedPoint.cover.tags?.mood}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Color Palette DNA</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedPoint.cover.tags?.colors.filter(c => c !== 'unknown').map((color, i) => (
                      <div key={i} className="group/color flex items-center gap-2 bg-white/[0.03] border border-white/5 pl-2 pr-4 py-2 rounded-full hover:bg-white/[0.08] transition-all">
                        <div 
                          className="w-4 h-4 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)] border border-white/20" 
                          style={{ backgroundColor: color }} 
                        />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest group-hover/color:text-white transition-colors">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Neural Constellation</p>
                    <button 
                      onClick={() => setIsConstellationExpanded(true)}
                      className="text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Expand Map
                    </button>
                  </div>
                  
                  <div 
                    onClick={() => setIsConstellationExpanded(true)}
                    className="relative w-full h-[240px] bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden cursor-zoom-in group/const"
                  >
                    <div className="absolute inset-0 bg-emerald-500/0 group-hover/const:bg-emerald-500/5 transition-colors z-10" />
                    
                    {/* The Central Node */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] bg-neutral-900">
                        <img src={selectedPoint.cover.image_url} className="w-full h-full object-cover" alt="" />
                      </div>
                    </div>

                    {/* Orbiting Lines (SVG Only) */}
                    <svg className="absolute inset-0 w-full h-full z-0">
                      {similarPoints.map((sp, i) => {
                        const angle = (i / similarPoints.length) * Math.PI * 2;
                        // Stronger match (closer to 1.0) = Smaller radius
                        const radius = 45 - (sp.similarityScore * 25); 
                        const x = 50 + Math.cos(angle) * radius;
                        const y = 50 + Math.sin(angle) * radius;
                        
                        return (
                          <motion.line 
                            key={`line-hud-${i}`}
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 0.2 }}
                            x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`}
                            stroke="#10b981" strokeWidth="1" strokeDasharray="3 3"
                          />
                        );
                      })}
                    </svg>

                    {/* Orbiting Nodes (Absolute Divs for perfect centering) */}
                    {similarPoints.map((sp, i) => {
                      const angle = (i / similarPoints.length) * Math.PI * 2;
                      const radius = 45 - (sp.similarityScore * 25);
                      const x = 50 + Math.cos(angle) * radius;
                      const y = 50 + Math.sin(angle) * radius;
                      
                      return (
                        <div 
                          key={`node-hud-${i}`}
                          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                          className="absolute z-20"
                        >
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(sp.uniqueKey);
                            }}
                            className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 cursor-pointer hover:border-emerald-500 hover:scale-110 transition-all shadow-xl grayscale-[0.5] hover:grayscale-0 bg-neutral-900"
                          >
                            <img src={sp.cover.image_url} className="w-full h-full object-cover" alt="" />
                          </motion.div>
                        </div>
                      );
                    })}
                    
                    <div className="absolute bottom-4 left-0 right-0 text-center z-10">
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Semantic Proximity clusters</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPANDED NEURAL WORKSPACE */}
      <AnimatePresence>
        {isConstellationExpanded && selectedPoint && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-[#020202]/95 backdrop-blur-2xl flex flex-col p-16"
          >
            <div className="flex justify-between items-start mb-12">
               <div className="space-y-2">
                 <div className="flex items-center gap-3">
                   <Target className="w-6 h-6 text-emerald-500" />
                   <h4 className="text-4xl font-black text-white uppercase tracking-tighter">Neural Workspace</h4>
                 </div>
                 <p className="text-xs font-bold text-white/30 uppercase tracking-[0.4em]">Deep Semantic Proximity Analysis</p>
               </div>
               <button 
                 onClick={() => setIsConstellationExpanded(false)}
                 className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all"
               >
                 <Minimize2 className="w-4 h-4" /> Exit Workspace
               </button>
            </div>

            <div className="flex-1 relative">
              {/* Macro Central Node */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                <div className="w-32 h-32 rounded-[40px] overflow-hidden border-4 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.5)] bg-neutral-900">
                  <img src={selectedPoint.cover.image_url} className="w-full h-full object-cover" alt="" />
                </div>
              </div>

              {/* Orbiting Lines (SVG) */}
              <svg className="absolute inset-0 w-full h-full overflow-visible z-10">
                {similarPoints.map((sp, i) => {
                  const angle = (i / similarPoints.length) * Math.PI * 2;
                  // Map similarity (usually 0.5 - 1.0) to radius (42% - 15%)
                  const radius = 50 - (sp.similarityScore * 35); 
                  const x = 50 + Math.cos(angle) * radius;
                  const y = 50 + Math.sin(angle) * radius;
                  
                  return (
                    <motion.line 
                      key={`line-macro-${i}`}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.3 }}
                      x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`}
                      stroke="#10b981" strokeWidth="1.5" strokeDasharray="6 6"
                    />
                  );
                })}
              </svg>

              {/* Orbiting Nodes (Absolute Divs) */}
              {similarPoints.map((sp, i) => {
                const angle = (i / similarPoints.length) * Math.PI * 2;
                const radius = 50 - (sp.similarityScore * 35); 
                const x = 50 + Math.cos(angle) * radius;
                const y = 50 + Math.sin(angle) * radius;
                
                return (
                  <div 
                    key={`node-macro-${i}`}
                    style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                    className="absolute z-20"
                  >
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ zIndex: 50 }}
                      onClick={() => setSelectedId(sp.uniqueKey)}
                      className="relative cursor-pointer group/macro"
                    >
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 group-hover/macro:border-emerald-500 transition-all shadow-2xl bg-neutral-900">
                        <img src={sp.cover.image_url} className="w-full h-full object-cover" alt="" />
                        
                        {/* Integrated Match Overlay */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover/macro:opacity-100 transition-all duration-300">
                           <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">Match</p>
                           <p className="text-sm font-black text-white leading-none">
                             {Math.round(sp.similarityScore * 100)}%
                           </p>
                        </div>
                      </div>
                      
                      {/* Subtle Label below (Optional/Minimal) */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover/macro:opacity-100 pointer-events-none transition-all scale-90 group-hover/macro:scale-100 whitespace-nowrap">
                         <p className="text-[7px] font-bold text-white/40 uppercase tracking-[0.1em]">
                           {(sp.cover.album_name || (sp.cover as any).title || 'Unknown').substring(0, 15)}...
                         </p>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto flex justify-between items-end border-t border-white/5 pt-12">
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Source Context</p>
                 <p className="text-xl font-black text-white uppercase tracking-tight">{selectedPoint.cover.album_name}</p>
                 <p className="text-sm font-bold text-emerald-500 uppercase tracking-widest">{selectedPoint.cover.artist}</p>
               </div>
               <div className="max-w-md text-right">
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] leading-relaxed">
                   Neural workspace mapping leverages 384-dimensional miniLM embeddings to identify latent visual relationships. Cluster proximity represents mathematical similarity in color density, composition, and aesthetic mood.
                 </p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INFO OVERLAY */}
      <AnimatePresence>
        {showInsight && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-12 z-[100] bg-[#e8e4db] p-16 border-[12px] border-black flex flex-col justify-center"
          >
            <button onClick={() => setShowInsight(false)} className="absolute top-12 right-12 w-20 h-20 bg-[#d32f2f] text-white border-[6px] border-black flex items-center justify-center font-black text-4xl hover:scale-110 transition-all">
              ×
            </button>
            <div className="max-w-4xl mx-auto space-y-12">
               <div className="space-y-4">
                <h4 className="text-7xl font-black text-black uppercase tracking-tighter leading-none border-l-[24px] border-black pl-8">Matrix<br/>Logic</h4>
                <p className="text-xl font-bold text-[#1976d2] uppercase tracking-[0.2em]">Mechanical Visual Translation</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                 <div className="space-y-6">
                   <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-black text-3xl">X</div>
                     <span className="text-3xl font-black text-black uppercase tracking-tighter">Luminance</span>
                   </div>
                   <p className="text-black font-bold uppercase text-sm leading-tight opacity-40">
                     SYSTEM PARSES PIXEL DENSITY TO DETERMINE GLOBAL LIGHT VALUE. NOIR CLUSTERS REPRESENTS DARKNESS. VIBRANT CLUSTERS REPRESENT MAXIMUM OUTPUT.
                   </p>
                 </div>
                 <div className="space-y-6">
                   <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-[#fbc02d] text-black border-[4px] border-black flex items-center justify-center font-black text-3xl">Y</div>
                     <span className="text-3xl font-black text-black uppercase tracking-tighter">Structural Density</span>
                   </div>
                   <p className="text-black font-bold uppercase text-sm leading-tight opacity-40">
                     MEASURING AESTHETIC SATURATION. SILENCE INDICATES MINIMAL GEOMETRY. DENSITY INDICATES MECHANICAL COMPLEXITY AND DATA NOISE.
                   </p>
                 </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
