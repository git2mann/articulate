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
    <div className="max-w-2xl mx-auto w-full p-6">
      {!isSearching ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              {isIndexing ? 'Calibrating Visuals...' : 'What do you remember?'}
            </h2>
            <p className="text-gray-400 font-medium text-lg opacity-60">
              {isIndexing ? 'Please wait while Gemini analyzes your library.' : 'Describe any colors, shapes, or moods.'}
            </p>
          </div>
          
          <div className={`search-input-container p-1 flex items-center gap-3 ${isIndexing ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="pl-4 text-gray-400">
              {isIndexing ? <Loader2 className="animate-spin" size={22} /> : <Search size={22} strokeWidth={2.5} />}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isIndexing}
              placeholder={isIndexing ? "Analyzing artwork..." : "e.g. A blue neon city with rain..."}
              className="flex-1 py-4 bg-transparent text-white text-lg placeholder:text-gray-600 outline-none"
            />
            <button
              type="submit"
              disabled={isIndexing}
              className="bg-[#007AFF] text-white font-bold px-8 py-3 rounded-[12px] hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 disabled:bg-gray-700 disabled:shadow-none"
            >
              {isIndexing ? 'Wait...' : 'Search'}
            </button>
          </div>
        </form>
      ) : (
        <div className="glass p-10 rounded-[28px] border border-white/5 shadow-2xl space-y-8 animate-in fade-in zoom-in duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)">
          {currentQuestion ? (
            <div className="space-y-8">
              <div className="flex items-center gap-3 text-[#007AFF]">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Sparkles size={18} />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Visual Guide</span>
              </div>
              
              <p className="text-3xl font-bold text-white leading-[1.2] tracking-tight">
                {getQuestionLabel(currentQuestion.attribute, currentQuestion.values)}
              </p>
              
              <div className="flex flex-wrap gap-3">
                {currentQuestion.values.map((val) => (
                  <button
                    key={val}
                    onClick={() => onAnswer(currentQuestion.attribute, val)}
                    className="px-8 py-4 rounded-[18px] bg-white/5 border border-white/5 text-white font-semibold hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all duration-300"
                  >
                    {getAnswerLabel(currentQuestion.attribute, val)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-6">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/40">
                <Sparkles className="text-white" size={40} />
              </div>
              <p className="text-3xl font-black text-white tracking-tight">Found your cover.</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-3 mx-auto text-blue-400 hover:text-blue-300 font-bold text-lg transition-colors"
              >
                <RotateCcw size={20} />
                Try another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
