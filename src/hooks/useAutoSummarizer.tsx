import { useEffect, useRef } from 'react';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { db } from '@/src/db';
import { callProxy } from '@/src/services/ai/proxy';

// We should have a debouncer or background tracking.
// We don't want to block the UI, and we want to allow failures without crashing.

export function useAutoSummarizer() {
  const { activeChapterId } = useNavigation();
  const prevChapterIdRef = useRef<number | null>(activeChapterId);

  useEffect(() => {
    // When active chapter changes, we check the previous one
    if (activeChapterId !== prevChapterIdRef.current) {
      const chapterToSummarize = prevChapterIdRef.current;
      prevChapterIdRef.current = activeChapterId;

      if (chapterToSummarize) {
        summarizeChapterBackground(chapterToSummarize);
      }
    }
  }, [activeChapterId]);
}

async function summarizeChapterBackground(chapterId: number) {
  try {
    const chapter = await db.chapters.get(chapterId);
    if (!chapter || !chapter.content || chapter.content.trim().length < 50) {
      return; // Too short to summarize
    }

    // Check if it's already summarized and not modified since
    if (chapter.summaryUpdatedAt && chapter.summaryUpdatedAt >= chapter.lastModified) {
      return; // Already up to date
    }

    console.log(`[AutoSummarize] Starting background summary for chapter ${chapterId}...`);

    // We use a predefined provider/model or standard API call.
    // We'll construct a simple prompt.
    // getSettings is in ai/index.ts but it's not exported. Let's just use localStorage or proxy directly.
    const provider = localStorage.getItem('ai_provider') || 'google';
    
    const loadKey = (name: string) => {
      try {
        const session = sessionStorage.getItem(`ai_key_${name}`);
        if (session) return session;
        const stored = localStorage.getItem(`ai_key_${name}`);
        return stored ? atob(stored) : '';
      } catch (e) {
        return '';
      }
    };
    const apiKey = loadKey(provider);
    if (!apiKey) return; // No key, can't summarize in background implicitly

    const model = localStorage.getItem(`ai_model_${provider}`) || undefined;

    const systemInstruction = 
      "Kamu adalah asisten editor novel profesional. Tugasmu adalah merangkum cerita bab yang diberikan ke dalam 1-2 paragraf singkat namun padat informasi. Fokus pada plot utama, karakter yang muncul, dan perubahan status quo. Format jawaban langsung ringkasan tanpa basa-basi.";

    const userPrompt = `Teks Bab:\n\n${chapter.content.substring(0, 15000)}`; // Max 15000 chars for safety

    const params = {
      systemInstruction,
      userPrompt,
      temperature: 0.3,
      maxTokens: 700, // ringkasan 1-2 paragraf; plafon mencegah output liar
      model,
      provider,
      actionType: 'summarize' as const
    };

    const summaryRes = await callProxy(provider, params, apiKey);
    
    if (summaryRes && summaryRes.trim().length > 0) {
      await db.chapters.update(chapterId, {
        summary: summaryRes.trim(),
        summaryUpdatedAt: Date.now()
      });
      console.log(`[AutoSummarize] Success for chapter ${chapterId}`);
    }

  } catch (error) {
    console.error(`[AutoSummarize] Failed to summarize chapter ${chapterId}:`, error);
  }
}
