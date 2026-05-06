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
  
  if (covers.length === 0) return null;

  const aggregateTags = () => {
    const stats: Record<string, Record<string, number>> = {
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
        stats.colors[color] = (stats.colors[color] || 0) + 1;
      });
      const attributes: (keyof VisualTags)[] = ['mood', 'style', 'composition', 'brightness'];
      attributes.forEach(attr => {
        const val = c.tags[attr] as string;
        if (!val || val === 'unknown') return;
        stats[attr][val] = (stats[attr][val] || 0) + 1;
      });
    });
    return stats;
  };

  const stats = aggregateTags();

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

  const renderStatGroup = (label: string, data: Record<string, number>, color: string) => {
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = Object.values(data).reduce((a, b) => a + b, 0);

    return (
      <div className="bauhaus-card p-8 flex flex-col bg-white">
        <div className="flex justify-between items-center mb-8 border-b-[3px] border-black pb-4">
           <h4 className="text-xs font-black uppercase tracking-widest">{label}</h4>
           <div className="bg-black text-white px-2 py-0.5 text-[10px] font-mono">N_{total}</div>
        </div>

        <div className="space-y-6 flex-1">
          {sorted.map(([name, count]) => {
            const percentage = Math.round((count / total) * 100);
            return (
              <div 
                key={name} 
                className="space-y-2 cursor-pointer group/item"
                onClick={() => setActiveFilter({ type: label, value: name })}
              >
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-tighter group-hover/item:text-[#1976d2] transition-colors">{name}</span>
                  <span className="text-[10px] font-black">{percentage}%</span>
                </div>
                
                <div className="h-6 border-[3px] border-black p-0.5 bg-white relative">
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${percentage}%` }}
                     className="h-full"
                     style={{ backgroundColor: color }}
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
    <div className="space-y-12 animate-in relative">
      
      {/* 1. TOP SIGNATURE CARD */}
      <div className="bauhaus-card p-12 flex flex-col lg:flex-row gap-12 items-stretch bg-white">
        <div className="w-full lg:w-72 bg-[#fbc02d] border-[6px] border-black flex flex-col items-center justify-center p-8 shrink-0">
           <div className="w-24 h-24 border-[6px] border-black rounded-full flex items-center justify-center bg-white mb-6">
              <Fingerprint className="w-12 h-12" />
           </div>
           <p className="text-[10px] font-black uppercase tracking-widest text-center">Neural<br/>Aesthetic<br/>Signature</p>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-8">
           <div className="space-y-2">
              <div className="bg-black text-white px-4 py-1 inline-block text-[10px] font-black uppercase tracking-[0.3em]">Neural Status: Nominal</div>
              <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.8]">{signature.topMood}<br/>{signature.topStyle}</h2>
           </div>
           <p className="text-xl font-bold uppercase leading-none border-l-[12px] border-black pl-6">
             Primary Structure: <span className="text-[#1976d2]">{signature.topComp}</span>
           </p>
        </div>

        <div className="w-full lg:w-48 flex flex-row lg:flex-col gap-[3px] bg-black">
           <div className="bg-white p-6 flex-1 flex flex-col items-center justify-center">
              <p className="text-[8px] font-black uppercase opacity-30 mb-2">ARCHIVE SIZE</p>
              <p className="text-4xl font-black leading-none">{covers.length}</p>
           </div>
           <div className="bg-[#d32f2f] text-white p-6 flex-1 flex flex-col items-center justify-center">
              <Activity className="w-6 h-6 mb-2" />
              <p className="text-xs font-black uppercase">NOMINAL</p>
           </div>
        </div>
      </div>

      {/* 2. CHROMATIC SPECTRUM */}
      <div className="space-y-4">
        <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-4">
          <div className="w-4 h-4 bg-black rounded-full" /> Chromatic Index distribution
        </h3>
        <div className="h-24 w-full flex border-[6px] border-black bg-white overflow-hidden p-1">
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
                <div className="absolute inset-0 border-x border-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 3. TECHNICAL METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[6px] bg-black border-[6px] border-black">
        {renderStatGroup('ATMOSPHERE', stats.mood, '#d32f2f')}
        {renderStatGroup('COMPOSITION', stats.composition, '#1976d2')}
        {renderStatGroup('VISUAL MODE', stats.style, '#fbc02d')}
        {renderStatGroup('LUMINANCE', stats.brightness, '#000000')}
      </div>

      {/* DRILL-DOWN DISCOVERY DRAWER */}
      <AnimatePresence>
        {activeFilter && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 bg-[#e8e4db] border-[12px] border-black p-12 lg:p-24 flex flex-col overflow-hidden"
          >
             <div className="flex justify-between items-start mb-16">
                <div className="space-y-6">
                   <div className="bg-[#1976d2] text-white px-6 py-2 inline-block font-black uppercase text-xs">FILTER: {activeFilter.type}</div>
                   <h1 className="text-7xl lg:text-9xl font-black uppercase tracking-tighter leading-[0.8]">{activeFilter.value}</h1>
                   <p className="text-xl font-bold uppercase border-l-[12px] border-black pl-6">
                      Found in {filteredCovers.length} indexed files
                   </p>
                </div>
                <button 
                  onClick={() => setActiveFilter(null)}
                  className="w-24 h-24 bg-[#d32f2f] text-white border-[6px] border-black flex items-center justify-center font-black text-6xl hover:scale-110 transition-transform"
                >
                   ×
                </button>
             </div>

             <div className="flex-1 overflow-y-auto pr-8 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                   {filteredCovers.map((c, i) => (
                      <div 
                        key={`${c.cover_id || (c as any).id}-${i}`}
                        className="bauhaus-card p-4 bg-white"
                      >
                         <div className="aspect-square border-[3px] border-black overflow-hidden mb-4">
                            <img src={c.image_url} className="w-full h-full object-cover" alt="" />
                         </div>
                         <p className="font-black uppercase truncate text-[10px] leading-tight">{c.album_name || (c as any).title}</p>
                         <p className="font-bold uppercase text-[8px] text-[#1976d2]">{c.artist}</p>
                      </div>
                   ))}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. FOOTER READOUT */}
      <div className="bg-black text-white p-12 grid grid-cols-1 md:grid-cols-3 gap-12">
         <div className="space-y-2">
            <p className="text-[10px] font-black uppercase opacity-40">System Architecture</p>
            <p className="text-xl font-bold uppercase tracking-tighter">Neural_Core_v3.42</p>
         </div>
         <div className="space-y-2">
            <p className="text-[10px] font-black uppercase opacity-40">Status Readout</p>
            <div className="flex items-center gap-4">
               <div className="w-4 h-4 bg-[#fbc02d] rounded-full animate-pulse" />
               <p className="text-xl font-bold uppercase tracking-tighter">NOMINAL_OPERATING_TEMP</p>
            </div>
         </div>
         <div className="flex flex-col justify-end text-right">
            <p className="text-[10px] font-mono opacity-20 uppercase">SEMANTIC_RETRIEVAL_REL_2026</p>
         </div>
      </div>
    </div>
  );
}
