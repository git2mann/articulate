'use client';

import { useState } from 'react';
import { VisualTags } from '@/types';
import { getQuestionLabel, getAnswerLabel } from '@/lib/engine';
import { Search, Sparkles, RotateCcw, Loader2 } from 'lucide-react';

interface ChatInterfaceProps {
  currentQuestion: { attribute: keyof VisualTags; values: string[] } | null;
  onAnswer: (attribute: keyof VisualTags, value: string) => void;
  onInitialQuery: (query: string) => void;
  isSearching: boolean;
  isIndexing?: boolean;
}

export default function ChatInterface({
  currentQuestion,
  onAnswer,
  onInitialQuery,
  isSearching,
  isIndexing = false,
}: ChatInterfaceProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onInitialQuery(query.trim());
      setQuery('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full p-6">
      {!isSearching ? (
        <form onSubmit={handleSubmit} className="space-y-12">
          <div className="text-center space-y-6">
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight text-foreground leading-tight">
              {isIndexing ? 'Calibrating Archive...' : 'Recall the memory.'}
            </h2>
            <p className="text-xs uppercase tracking-[0.4em] font-medium opacity-20">
              {isIndexing ? 'Wait while neural fingerprints are indexed' : 'Describe the atmosphere, colors, or shapes'}
            </p>
          </div>
          
          <div className={`p-1 flex items-center gap-6 border-b border-foreground/5 pb-6 transition-all ${isIndexing ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="opacity-20">
              {isIndexing ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isIndexing}
              placeholder={isIndexing ? "Neural indexing in progress..." : "DESCRIBE MOODS, VAGUE SHAPES..."}
              className="flex-1 bg-transparent text-foreground text-2xl font-light placeholder:text-foreground/5 outline-none"
            />
            <button
              type="submit"
              disabled={isIndexing}
              className="elegant-button px-10 py-4"
            >
              <span className="uppercase tracking-[0.2em] text-[10px] font-bold">
                {isIndexing ? 'Wait' : 'Recall'}
              </span>
            </button>
          </div>
        </form>
      ) : (
        <div className="glass-card p-12 lg:p-16 space-y-12 animate-in border-foreground/5 shadow-2xl">
          {currentQuestion ? (
            <div className="space-y-12">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-30">Inference Guidance</span>
              </div>
              
              <p className="text-4xl font-light text-foreground leading-tight tracking-tight">
                {getQuestionLabel(currentQuestion.attribute, currentQuestion.values)}
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                {currentQuestion.values.map((val) => (
                  <button
                    key={val}
                    onClick={() => onAnswer(currentQuestion.attribute, val)}
                    className="px-10 py-5 rounded-lg bg-foreground/5 text-foreground font-medium text-sm hover:bg-foreground hover:text-background transition-all duration-500 uppercase tracking-widest"
                  >
                    {getAnswerLabel(currentQuestion.attribute, val)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-10">
              <div className="w-20 h-20 border border-accent/20 rounded-full flex items-center justify-center mx-auto relative">
                <Sparkles className="text-accent opacity-40" size={32} />
                <div className="absolute inset-2 rounded-full border border-accent/10 animate-pulse" />
              </div>
              <div className="space-y-4">
                <p className="text-4xl font-light text-foreground tracking-tight leading-none">Retrieval Complete.</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-20">Memory Successfully Matched</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-4 mx-auto text-foreground/40 hover:text-foreground font-bold text-[10px] uppercase tracking-[0.2em] transition-all"
              >
                <RotateCcw size={14} />
                New Inference Cycle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
