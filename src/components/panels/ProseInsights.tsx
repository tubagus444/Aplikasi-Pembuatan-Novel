/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ProseMetrics } from '../../types';
import { Gauge, BookOpen, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { stripHtml } from '../../lib/editorUtils';

interface ProseInsightsProps {
  content: string;
}

export function ProseInsights({ content }: ProseInsightsProps) {
  const metrics = useMemo<ProseMetrics>(() => {
    const text = stripHtml(content).trim();
    if (!text) return {
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      longSentences: 0,
      passiveVoiceCount: 0,
      adverbCount: 0,
      readabilityScore: 0
    };

    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Simple adverb detection (ending in 'ly')
    const adverbs = words.filter(w => w.toLowerCase().endsWith('ly')).length;
    
    // Simple passive voice detection (be/was/were/been + past participle is hard, so we do a naive check for common helper words)
    const passiveWords = ['was', 'were', 'been', 'being', 'is', 'am', 'are'];
    const passiveCount = words.filter((w, i) => 
      passiveWords.includes(w.toLowerCase()) && 
      words[i+1]?.toLowerCase().endsWith('ed')
    ).length;

    const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 25).length;
    
    // Flesch Reading Ease (simplified)
    // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
    // Syllable approximation: vowels
    const syllables = text.toLowerCase().match(/[aeiouy]+/g)?.length || 0;
    const readability = Math.max(0, Math.min(100, Math.round(
      206.835 - 1.015 * (words.length / (sentences.length || 1)) - 84.6 * (syllables / words.length)
    )));

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgSentenceLength: Math.round(words.length / (sentences.length || 1)),
      longSentences,
      passiveVoiceCount: passiveCount,
      adverbCount: adverbs,
      readabilityScore: readability
    };
  }, [content]);

  const getReadabilityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getReadabilityLabel = (score: number) => {
    if (score >= 80) return 'Very Easy';
    if (score >= 60) return 'Standard';
    if (score >= 40) return 'Fairly Difficult';
    return 'Very Difficult';
  };

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
      <header className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Gauge size={14} />
          Prose Insights
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Readability Meter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Readability Score</span>
            <span className={`text-xs font-bold ${getReadabilityColor(metrics.readabilityScore)}`}>
              {metrics.readabilityScore} / 100
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-out bg-current ${getReadabilityColor(metrics.readabilityScore)}`}
              style={{ width: `${metrics.readabilityScore}%`, background: 'currentColor' }}
            />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Targeting {getReadabilityLabel(metrics.readabilityScore)} style.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Avg. Sentence</p>
            <p className="text-xl font-serif text-slate-800 dark:text-slate-200">{metrics.avgSentenceLength} <span className="text-[10px] font-sans font-medium text-slate-400 dark:text-slate-500">words</span></p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Long Sentences</p>
            <p className={`text-xl font-serif ${metrics.longSentences > 5 ? 'text-orange-500' : 'text-slate-800 dark:text-slate-200'}`}>{metrics.longSentences}</p>
          </div>
        </div>

        {/* Style Alerts */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Style Alerts</span>
          
          <div className="space-y-2">
            {metrics.passiveVoiceCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <AlertCircle size={14} className="text-red-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-red-700 dark:text-red-400">Passive Voice detected ({metrics.passiveVoiceCount})</p>
                  <p className="text-[10px] text-red-500 dark:text-red-300 leading-tight">Consider using active verbs to make your prose more punchy.</p>
                </div>
              </div>
            )}

            {metrics.adverbCount > 10 && (
              <div className="flex items-start gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                <Sparkles size={14} className="text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">Adverb heavy ({metrics.adverbCount})</p>
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-300 leading-tight">"The road to hell is paved with adverbs." Try stronger verbs instead.</p>
                </div>
              </div>
            )}

            {metrics.longSentences > 3 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                <BookOpen size={14} className="text-amber-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Lengthy sentences</p>
                  <p className="text-[10px] text-amber-500 dark:text-amber-300 leading-tight">Break up long sentences to improve flow and reader engagement.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-indigo-600 rounded-xl text-white shadow-lg space-y-2">
          <div className="flex items-center gap-2">
            <Wand2 size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest">AI Tip</span>
          </div>
          <p className="text-[11px] font-medium leading-relaxed opacity-90">
            Your prose is currently {metrics.readabilityScore > 60 ? 'easy to read' : 'a bit dense'}. Consider adjusting based on your target audience's genre expectations.
          </p>
        </div>
      </div>
    </div>
  );
}
