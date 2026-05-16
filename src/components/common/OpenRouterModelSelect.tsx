import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Loader2, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { fetchOpenRouterModels, OpenRouterModel } from '../../services/ai/modelService';
import { cn } from '../../lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function OpenRouterModelSelect({ value, onChange }: Props) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const loadModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchOpenRouterModels();
      if (data && data.length > 0) {
        setModels(data);
      } else {
        setError("Failed to load models. Check your OpenRouter key.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load models. Check your OpenRouter key.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const filteredModels = useMemo(() => {
    if (!search) return models;
    const s = search.toLowerCase();
    return models.filter(m => 
      m.name.toLowerCase().includes(s) || 
      m.id.toLowerCase().includes(s)
    );
  }, [models, search]);

  const selectedModel = useMemo(() => 
    models.find(m => m.id === value) || { id: value, name: value }, 
  [models, value]);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between"
      >
        <span className={cn("truncate", error && "text-red-500 dark:text-red-400")}>
          {isLoading ? 'Loading models...' : (error ? 'Failed to load models' : (selectedModel.name || 'Select a model...'))}
        </span>
        {isLoading ? (
          <Loader2 size={14} className="animate-spin text-slate-400" />
        ) : error ? (
          <AlertCircle size={14} className="text-red-500" />
        ) : (
          <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs focus:ring-0 focus:outline-none text-slate-900 dark:text-slate-100"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {error ? (
              <div className="p-4 text-center">
                <AlertCircle size={20} className="mx-auto mb-2 text-red-500 opacity-50" />
                <p className="text-xs text-red-600 dark:text-red-400 mb-2 font-medium">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadModels();
                  }}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Try again
                </button>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                No models found.
              </div>
            ) : (
              filteredModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex flex-col gap-0.5 group transition-colors",
                    value === m.id && "bg-indigo-50/50 dark:bg-indigo-900/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("font-medium", value === m.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300")}>
                      {m.name}
                    </span>
                    {value === m.id && <Check size={12} className="text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {m.id}
                  </span>
                </button>
              ))
            )}
          </div>
          
          {search && models.length > 0 && !filteredModels.find(m => m.id === search) && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => {
                  onChange(search);
                  setIsOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-2 py-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Use custom model ID: "{search}"
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
