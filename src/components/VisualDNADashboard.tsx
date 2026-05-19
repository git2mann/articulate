'use client';

import React, { useState, useMemo } from 'react';
import { CoverObject, VisualTags } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Palette, Wind, Box, Camera, BarChart3, Fingerprint, X, Cpu, Gauge, Terminal, ChevronRight, Circle, Triangle, Square as SquareIcon } from 'lucide-react';

interface VisualDNADashboardProps {
  covers: CoverObject[];
}

export default function VisualDNADashboard({ covers }: VisualDNADashboardProps) {
  const [activeFilter, setActiveFilter] = useState<{ type: string, value: string } | null>(null);
  
  const stats = useMemo(() => {
    const s: Record<string, Record<string, number>> = {
      colors: {},
      mood: {},
      style: {},
      composition: {},
      brightness: {}
    };

    covers.forEach(c => {
      if (!c.tags) return;
      c.tags.colors.forEach(color => {
        if (color === 'unknown') return;
        s.colors[color] = (s.colors[color] || 0) + 1;
      });
      const attributes: (keyof VisualTags)[] = ['mood', 'style', 'composition', 'brightness'];
      attributes.forEach(attr => {
        const val = c.tags[attr] as string;
        if (!val || val === 'unknown') return;
        s[attr][val] = (s[attr][val] || 0) + 1;
      });
    });
    return s;
  }, [covers]);

  const filteredCovers = useMemo(() => {
    if (!activeFilter) return [];
    return covers.filter(c => {
      const tags = c.tags;
      if (!tags) return false;
      if (activeFilter.type === 'colors') return tags.colors.includes(activeFilter.value);
      if (activeFilter.type === 'ATMOSPHERE') return tags.mood === activeFilter.value;
      if (activeFilter.type === 'COMPOSITION') return tags.composition === activeFilter.value;
      if (activeFilter.type === 'VISUAL MODE') return tags.style === activeFilter.value;
      if (activeFilter.type === 'LUMINANCE') return tags.brightness === activeFilter.value;
      return false;
    });
  }, [activeFilter, covers]);

  const signature = useMemo(() => {
    const topMood = Object.entries(stats.mood).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const topStyle = Object.entries(stats.style).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const topComp = Object.entries(stats.composition).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    return { topMood, topStyle, topComp };
  }, [stats]);

  if (covers.length === 0) return null;

  const renderStatGroup = (label: string, data: Record<string, number>, color: string) => {
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = Object.values(data).reduce((a, b) => a + b, 0);

    return (
      <div className="glass-card p-8 flex flex-col border-transparent hover:border-foreground/5">
        <div className="flex justify-between items-center mb-10 border-b border-foreground/5 pb-5">
           <h4 className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-40">{label}</h4>
           <div className="text-[9px] font-medium opacity-20">n={total}</div>
        </div>

        <div className="space-y-8 flex-1">
          {sorted.map(([name, count]) => {
            const percentage = Math.round((count / total) * 100);
            return (
              <div 
                key={name} 
                className="space-y-3 cursor-pointer group/item"
                onClick={() => setActiveFilter({ type: label, value: name })}
              >
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-medium uppercase tracking-widest opacity-60 group-hover/item:opacity-100 group-hover/item:text-accent transition-all">{name}</span>
                  <span className="text-[10px] font-medium opacity-30">{percentage}%</span>
                </div>
                
                <div className="h-1 bg-foreground/5 rounded-full overflow-hidden relative">
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${percentage}%` }}
                     className="h-full rounded-full"
                     style={{ backgroundColor: color, opacity: 0.6 }}
                   />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-16 animate-in relative pb-24">
      
      {/* 1. TOP SIGNATURE CARD */}
      <div className="glass-card p-12 lg:p-16 flex flex-col lg:flex-row gap-16 items-center">
        <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-full border border-accent/20 flex items-center justify-center bg-accent/5 shrink-0 relative">
           <Fingerprint className="w-10 h-10 lg:w-14 lg:h-14 opacity-40 text-accent" />
           <div className="absolute inset-2 rounded-full border border-accent/10 animate-pulse" />
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-6 text-center lg:text-left">
           <div className="space-y-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-20">Aesthetic Signature</div>
              <h2 className="text-5xl md:text-7xl font-light tracking-tight leading-tight">{signature.topMood} <span className="text-fluid-gradient !font-medium">{signature.topStyle}</span></h2>
           </div>
           <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-40 italic">
             Compositional Core: <span className="text-foreground/80">{signature.topComp}</span>
           </p>
        </div>

        <div className="flex gap-12 lg:gap-16 border-l border-foreground/5 pl-12 lg:pl-16">
           <div className="flex flex-col items-center justify-center">
              <p className="text-[8px] font-bold uppercase tracking-[0.3em] opacity-20 mb-3">Index</p>
              <p className="text-5xl font-light leading-none">{covers.length}</p>
           </div>
           <div className="flex flex-col items-center justify-center opacity-40">
              <Activity className="w-6 h-6 mb-3 text-accent" />
              <p className="text-[8px] font-bold uppercase tracking-widest">Stable</p>
           </div>
        </div>
      </div>

      {/* 2. CHROMATIC SPECTRUM */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-[1px] flex-1 bg-foreground/5" />
          <h3 className="font-bold uppercase tracking-[0.3em] text-[10px] opacity-20 px-4">Chromatic Distribution</h3>
          <div className="h-[1px] flex-1 bg-foreground/5" />
        </div>
        <div className="h-20 w-full flex rounded-xl overflow-hidden shadow-sm border border-foreground/5 bg-background p-1">
          {Object.entries(stats.colors).sort((a, b) => b[1] - a[1]).map(([color, count]) => {
            const totalColors = Object.values(stats.colors).reduce((a, b) => a + b, 0);
            const percentage = (count / totalColors) * 100;
            return (
              <motion.div
                key={color}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                className="h-full relative cursor-pointer group"
                style={{ backgroundColor: color }}
                onClick={() => setActiveFilter({ type: 'colors', value: color })}
              >
                <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-20 transition-opacity" />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 3. TECHNICAL METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderStatGroup('ATMOSPHERE', stats.mood, 'var(--accent)')}
        {renderStatGroup('COMPOSITION', stats.composition, 'var(--accent)')}
        {renderStatGroup('VISUAL MODE', stats.style, 'var(--accent)')}
        {renderStatGroup('LUMINANCE', stats.brightness, 'var(--accent)')}
      </div>

      {/* DRILL-DOWN DISCOVERY DRAWER */}
      <AnimatePresence>
        {activeFilter && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-8 lg:inset-20 z-[100] glass-card border-foreground/10 shadow-2xl p-12 lg:p-20 flex flex-col overflow-hidden"
          >
             <div className="flex justify-between items-start mb-16">
                <div className="space-y-6">
                   <div className="text-accent text-[10px] font-bold tracking-[0.4em] uppercase opacity-60">{activeFilter.type}</div>
                   <h1 className="text-6xl lg:text-8xl font-light tracking-tight leading-none uppercase">{activeFilter.value}</h1>
                   <div className="h-[1px] w-24 bg-accent/20" />
                   <p className="text-sm font-medium tracking-[0.2em] uppercase opacity-40">
                      Found in {filteredCovers.length} indexed files
                   </p>
                </div>
                <button 
                  onClick={() => setActiveFilter(null)}
                  className="w-12 h-12 rounded-full hover:bg-foreground/5 flex items-center justify-center opacity-40 hover:opacity-100 transition-all"
                >
                   <X className="w-8 h-8 font-light" />
                </button>
             </div>

             <div className="flex-1 overflow-y-auto pr-8 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                   {filteredCovers.map((c, i) => (
                      <div 
                        key={`${c.cover_id || (c as any).id}-${i}`}
                        className="glass-card p-4 border-transparent hover:border-foreground/5 group cursor-pointer"
                      >
                         <div className="aspect-square rounded-lg overflow-hidden mb-6 shadow-sm">
                            <img src={c.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                         </div>
                         <p className="font-medium uppercase truncate text-[10px] tracking-widest mb-1 opacity-80">{c.album_name || (c as any).title}</p>
                         <p className="font-medium uppercase text-[8px] tracking-[0.2em] opacity-30">{c.artist}</p>
                      </div>
                   ))}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. FOOTER READOUT */}
      <div className="glass-card p-12 border-transparent border-t-foreground/5 grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
         <div className="space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-20">Architecture</p>
            <p className="text-sm font-medium tracking-widest opacity-60 italic">Neural_Archive_2026.rel</p>
         </div>
         <div className="space-y-3 flex flex-col items-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-20 text-center">Diagnostics</p>
            <div className="flex items-center gap-4">
               <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
               <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Operational Stability Nominal</p>
            </div>
         </div>
         <div className="flex flex-col items-end">
            <p className="text-[9px] font-mono opacity-10 uppercase tracking-[0.5em]">ARTICULATE_RETRIEVAL_CORE</p>
         </div>
      </div>
    </div>
  );
}
