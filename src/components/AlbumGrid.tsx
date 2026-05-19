'use client';

import { CoverObject } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useTheme } from './ThemeContext';
import { X } from 'lucide-react';


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
                className="group glass-card cursor-pointer overflow-hidden border-transparent hover:border-accent/10"
                onClick={() => setModalCover(cover)}
                onMouseEnter={() => setThemeFromImage(cover.image_url)}
                onMouseLeave={resetTheme}
              >
                <div className="aspect-square overflow-hidden bg-foreground/5 relative">
                  <img
                    src={cover.image_url}
                    alt={`${cover.album_name} by ${cover.artist}`}
                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${(!cover.tags || !cover.tags.colors || cover.tags.colors[0] === 'unknown') && !cover.visualDescription ? 'grayscale opacity-50' : ''}`}
                  />
                  {(!cover.tags || !cover.tags.colors || cover.tags.colors[0] === 'unknown') && !cover.visualDescription && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="px-3 py-1 bg-background/80 backdrop-blur-md rounded-full shadow-sm border border-foreground/5">
                        <p className="text-[7px] font-bold text-foreground/60 uppercase tracking-[0.2em] leading-none">Indexing</p>
                      </div>
                    </div>
                  )}
                  {typeof confidences !== 'undefined' && confidences[idx] !== undefined && (
                    <div className="absolute top-4 right-4 bg-accent text-background text-[7px] font-bold px-2 py-1 rounded-sm shadow-lg uppercase tracking-widest">
                      {(confidences[idx] * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-1.5">
                  <h3 className="text-foreground font-medium text-[11px] uppercase leading-tight truncate tracking-widest opacity-80">
                    {cover.album_name}
                  </h3>
                  <p className="text-foreground/30 text-[9px] font-medium truncate uppercase tracking-[0.2em]">
                    {cover.artist}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {modalCover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm p-4" onClick={() => setModalCover(null)}>
          <div className="glass-card p-12 lg:p-16 max-w-3xl w-full relative animate-in border-foreground/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-6 right-6 w-10 h-10 rounded-full hover:bg-foreground/5 flex items-center justify-center transition-colors opacity-40 hover:opacity-100" 
              onClick={() => setModalCover(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="w-full md:w-72 aspect-square rounded-xl shadow-2xl shrink-0 relative overflow-hidden bg-foreground/5">
                <img src={modalCover.image_url} alt={modalCover.album_name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-10">
                <div className="space-y-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-20">Archive Metadata</p>
                  <h2 className="text-4xl lg:text-5xl font-light tracking-tight leading-none">{modalCover.album_name}</h2>
                  <p className="text-xl font-medium text-accent/80 tracking-wide">{modalCover.artist}</p>
                </div>
                <div className="space-y-4">
                  <div className="h-[1px] w-12 bg-accent/20" />
                  <p className="text-sm font-medium tracking-wide leading-relaxed opacity-60 italic">&quot;{modalCover.description || modalCover.visualDescription || 'Neural fingerprint data unavailable.'}&quot;</p>
                </div>
                <button 
                  onClick={() => setModalCover(null)}
                  className="elegant-button w-full bg-foreground text-background hover:opacity-90 uppercase tracking-[0.2em] text-[10px] font-bold py-4"
                >
                  Return to Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
