import React from 'react';
import { FileText, Edit2, X } from 'lucide-react';

interface ContextPreviewProps {
  chapterTitle?: string;
  sceneName: string;
  wordCount: number;
  onChange: () => void;
  onRemove: () => void;
}

export function ContextPreview({ chapterTitle, sceneName, wordCount, onChange, onRemove }: ContextPreviewProps) {
  return (
    <div className="mx-4 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-md text-indigo-600 dark:text-indigo-400 shrink-0">
          <FileText size={16} />
        </div>
        <div className="min-w-0 text-sm flex gap-2 items-center">
          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
            {chapterTitle || 'Chapter Context'}
          </p>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-indigo-200 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-800 rounded shrink-0">
            {sceneName}
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            · {wordCount} words attached
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {/* Leaving onChange enabled for future or custom interactions */}
        <button 
          onClick={onChange}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"
          title="Ganti Manual"
        >
          <Edit2 size={14} />
        </button>
        <button 
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"
          title="Hapus Konteks"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
