'use client';

import { CoverObject } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';


interface AlbumGridProps {
  covers: CoverObject[];
  confidences?: number[];
}

export default function AlbumGrid({ covers, confidences }: AlbumGridProps) {
  const [modalCover, setModalCover] = useState<CoverObject | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 p-4">
        <AnimatePresence mode="popLayout">
          {covers.map((cover, idx) => {
            if (!cover) return null;
            return (
              <motion.div
                key={cover.cover_id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.2, 0.8, 0.2, 1]
                }}
                className="group apple-card cursor-pointer shadow-sm"
                onClick={() => setModalCover(cover)}
              >
                <div className="aspect-square overflow-hidden bg-[#1c1c1e] relative">
                  <img
                    src={cover.image_url}
                    alt={`${cover.album_name} by ${cover.artist}`}
                    className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110 ${!cover.tags || Object.keys(cover.tags).length === 0 || !cover.tags.colors || cover.tags.colors.length === 0 || cover.tags.colors[0] === 'unknown' ? 'grayscale opacity-40' : ''}`}
                  />
                  {(!cover.tags || Object.keys(cover.tags).length === 0 || !cover.tags.colors || cover.tags.colors.length === 0 || cover.tags.colors[0] === 'unknown') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                        <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Pending Analysis</p>
                      </div>
                    </div>
                  )}
                  {typeof confidences !== 'undefined' && confidences[idx] !== undefined && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Confidence: {(confidences[idx] * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1 bg-gradient-to-b from-transparent to-black/20">
                  <h3 className="text-white font-semibold text-[15px] leading-tight truncate tracking-tight">
                    {cover.album_name}
                  </h3>
                  <p className="text-gray-400 text-xs font-medium truncate uppercase tracking-widest opacity-80">
                    {cover.artist}
                  </p>
                </div>
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {modalCover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setModalCover(null)}>
          <div className="bg-[#18181b] rounded-2xl p-8 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-gray-400 hover:text-white" onClick={() => setModalCover(null)}>&times;</button>
            <h2 className="text-xl font-bold text-white mb-2">Model Description</h2>
            <p className="text-gray-200 mb-4">{modalCover.description || 'No description available.'}</p>
            <img src={modalCover.image_url} alt={modalCover.album_name} className="w-full rounded-lg mb-2" />
            <div className="text-xs text-gray-400">{modalCover.album_name} by {modalCover.artist}</div>
          </div>
        </div>
      )}
    </>
  );
}
