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

  useEffect(() => {
    // Vector Update Daemon
    // Processes Codex and Chapter summaries to generate mock "embeddings" in idle time
    let isRunning = true;
    let timerId: any;

    const processVectorBatch = async () => {
      if (!isRunning) return;

      try {
        const cacheRaw = localStorage.getItem('semantic_vector_cache_v1');
        let cache = cacheRaw ? JSON.parse(cacheRaw) : {};
        let modified = false;

        // Process a batch of up to 5 Codex Entries
        const codexEntries = await db.codex.toArray();
        let processedCount = 0;

        for (const entry of codexEntries) {
          if (processedCount >= 5) break;
          // Simple cache key based on updated time and id
          const hashKey = `codex_${entry.id}_${(entry as any).updatedAt || 0}`;
          
          if (!cache[hashKey]) {
            // "Generate" vector (mock for now since full embeddings require API or large local models)
            // Just mark it processed so we know it's in the semantic search index
            cache[hashKey] = {
              type: 'codex',
              id: entry.id,
              text: `${entry.name} ${entry.category} ${entry.description}`,
              vector: Array(10).fill(0).map(() => Math.random()), // Mock vector embedding
              timestamp: Date.now()
            };
            modified = true;
            processedCount++;
          }
        }

        if (modified) {
          localStorage.setItem('semantic_vector_cache_v1', JSON.stringify(cache));
          console.debug(`[VectorDaemon] Processed batch of ${processedCount} entries during idle time`);
        }
      } catch (err) {
        console.error('[VectorDaemon] Batch processing error:', err);
      }

      // Schedule next idle check
      if (isRunning) {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            timerId = setTimeout(processVectorBatch, 5000);
          }, { timeout: 10000 });
        } else {
          timerId = setTimeout(processVectorBatch, 5000);
        }
      }
    };

    // Start initial delay to not block load
    timerId = setTimeout(processVectorBatch, 10000);

    return () => {
      isRunning = false;
      clearTimeout(timerId);
    };
  }, []);
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
      model,
      provider
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
