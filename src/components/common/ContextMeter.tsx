/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Target, Cpu, Loader2, Info } from 'lucide-react';
import { useProject } from '@/src/contexts/ProjectContext';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useContextMeter } from '@/src/hooks/useContextMeter';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useAvailableProviders } from '@/src/hooks/useAvailableProviders';

export function ContextMeter() {
  const { projectId } = useProject();
  const { activeChapter } = useNavigation();
  const chapterText = activeChapter?.content || '';
  const { selectedProvider } = useAvailableProviders();

  const { model, modelContextLimit } = useMemo(() => {
    let limit = 128000;
    let m = 'gpt-4o'; // Default standard

    if (selectedProvider === 'google') {
      m = localStorage.getItem('ai_model_google') || 'gemini-1.5-flash';
      limit = m.includes('pro') ? 2000000 : Math.max(1000000, 100000); // 1M+ limit usually
    } else if (selectedProvider === 'claude') {
      m = localStorage.getItem('ai_model_claude') || 'claude-3.5-sonnet';
      limit = 200000;
    } else if (selectedProvider === 'groq') {
      m = localStorage.getItem('ai_model_groq') || 'llama3-8b-8192';
      limit = m.includes('8192') ? 8192 : 32000;
    } else if (selectedProvider === 'ollama') {
      m = localStorage.getItem('ollama_model') || 'llama3';
      limit = 8192; // usually 8k context locally
    } else if (selectedProvider === 'openrouter') {
      m = localStorage.getItem('ai_model_openrouter') || 'openrouter/auto';
      limit = 128000; // rough generic limit
    }
    
    return { model: m, modelContextLimit: limit };
  }, [selectedProvider]);

  const { tokens, isCalculating } = useContextMeter(projectId, activeChapter?.id || null, chapterText, model);

  if (!projectId || !activeChapter) return null;

  const usagePercent = Math.min(100, Math.round((tokens.totalTokens / modelContextLimit) * 100));

  let colorClass = 'text-emerald-500';
  let borderClass = 'border-emerald-200 dark:border-emerald-900/50';
  let bgClass = 'bg-emerald-50 dark:bg-emerald-900/10';

  if (usagePercent > 85) {
    colorClass = 'text-red-500';
    borderClass = 'border-red-200 dark:border-red-900/50';
    bgClass = 'bg-red-50 dark:bg-red-900/10';
  } else if (usagePercent > 60) {
    colorClass = 'text-amber-500';
    borderClass = 'border-amber-200 dark:border-amber-900/50';
    bgClass = 'bg-amber-50 dark:bg-amber-900/10';
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 ${bgClass} hover:bg-opacity-80 border ${borderClass} rounded-full transition-colors group text-left relative`}
            aria-label="Context Meter"
          >
            {isCalculating ? (
              <Loader2 size={12} className={`animate-spin ${colorClass}`} />
            ) : (
              <Cpu size={14} className={`${colorClass} group-hover:scale-110 transition-transform`} />
            )}
            <span className={`text-[11px] font-bold ${colorClass} mr-0.5`}>
              {usagePercent}%
            </span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs rounded-lg shadow-xl px-3 py-2 border border-slate-200 dark:border-slate-800 flex flex-col gap-1 w-64"
            sideOffset={5}
          >
            <div className="font-bold flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Context Meter</span>
              <span className="text-xs text-indigo-500">{tokens.totalTokens.toLocaleString()} / {modelContextLimit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Model:</span>
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">{model}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] mt-1">
              <span className="text-slate-400">Chapter Text</span>
              <span className="font-medium">{tokens.textTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Lore/Codex</span>
              <span className="font-medium">{tokens.codexTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Story Bible</span>
              <span className="font-medium">{tokens.rulesTokens.toLocaleString()}</span>
            </div>
            <Tooltip.Arrow className="fill-white dark:fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
