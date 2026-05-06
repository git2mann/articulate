'use client';

import { CoverObject } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useTheme } from './ThemeContext';


interface AlbumGridProps {
  covers: CoverObject[];
  confidences?: number[];
}

export default function AlbumGrid({ covers, confidences }: AlbumGridProps) {
  const [modalCover, setModalCover] = useState<CoverObject | null>(null);
  const { setThemeFromImage, resetTheme } = useTheme();

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 p-4">
        <AnimatePresence mode="popLayout">
          {covers.map((cover, idx) => {
            if (!cover) return null;
            // Use cover_id if available, fallback to index to ensure uniqueness
            const uniqueKey = cover.cover_id ? `${cover.cover_id}-${idx}` : `album-${idx}`;
            return (
              <motion.div
                key={uniqueKey}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ 
                  duration: 0.3, 
                  ease: "easeOut"
                }}
                className="group bauhaus-card cursor-pointer !bg-white"
                onClick={() => setModalCover(cover)}
                onMouseEnter={() => setThemeFromImage(cover.image_url)}
                onMouseLeave={resetTheme}
              >
                <div className="aspect-square overflow-hidden bg-black relative border-b-[3px] border-black">
                  <img
                    src={cover.image_url}
                    alt={`${cover.album_name} by ${cover.artist}`}
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!cover.tags || Object.keys(cover.tags).length === 0 || !cover.tags.colors || cover.tags.colors.length === 0 || cover.tags.colors[0] === 'unknown' ? 'grayscale opacity-50' : ''}`}
                  />
                  {(!cover.tags || Object.keys(cover.tags).length === 0 || !cover.tags.colors || cover.tags.colors.length === 0 || cover.tags.colors[0] === 'unknown') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="px-3 py-1 bg-[#fbc02d] border-[2px] border-black">
                        <p className="text-[8px] font-black text-black uppercase tracking-widest leading-none">PENDING ANALYSIS</p>
                      </div>
                    </div>
                  )}
                  {typeof confidences !== 'undefined' && confidences[idx] !== undefined && (
                    <div className="absolute top-0 right-0 bg-[#1976d2] text-white text-[8px] font-black px-2 py-1 border-l-[3px] border-b-[3px] border-black uppercase">
                      {(confidences[idx] * 100).toFixed(0)}% MATCH
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="text-black font-black text-sm uppercase leading-tight truncate tracking-tighter">
                    {cover.album_name}
                  </h3>
                  <p className="text-black/40 text-[9px] font-bold truncate uppercase tracking-widest">
                    {cover.artist}
                  </p>
                </div>
                {/* Geometric Overlay */}
                <div className="absolute inset-0 border-[6px] border-[#d32f2f] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {modalCover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setModalCover(null)}>
          <div className="bg-[#e8e4db] border-[6px] border-black p-12 max-w-2xl w-full relative animate-in" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute -top-6 -right-6 w-12 h-12 bg-[#d32f2f] text-white border-[4px] border-black flex items-center justify-center font-black text-2xl hover:scale-110 transition-transform" 
              onClick={() => setModalCover(null)}
            >
              ×
            </button>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-64 aspect-square border-[6px] border-black shrink-0 relative bg-black">
                <img src={modalCover.image_url} alt={modalCover.album_name} className="w-full h-full object-cover" />
                <div className="absolute -bottom-4 -left-4 bg-[#fbc02d] text-black px-4 py-2 font-black text-[10px] uppercase border-[3px] border-black shadow-[4px_4px_0px_black]">
                  MECHANICAL DATA
                </div>
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">{modalCover.album_name}</h2>
                  <p className="text-xl font-bold uppercase text-[#1976d2]">{modalCover.artist}</p>
                </div>
                <div className="bg-white border-[3px] border-black p-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 opacity-30">Neural Fingerprint</h4>
                  <p className="text-sm font-bold uppercase leading-tight italic">&quot;{modalCover.description || 'No description available.'}&quot;</p>
                </div>
                <button 
                  onClick={() => setModalCover(null)}
                  className="bauhaus-button w-full bg-black text-white hover:bg-[#1976d2]"
                >
                  CLOSE ARCHIVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
