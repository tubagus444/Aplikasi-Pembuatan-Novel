import { useState } from 'react';
import { db } from '@/src/db';
import { processChat } from '@/src/services/ai';
import { useToast } from '@/src/hooks/useToast';

export function useGenerateBeats(projectId: number) {
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const { toast } = useToast();

  const generateBeats = async (chapterId: number, currentTitle: string, currentSummary: string) => {
    setIsGenerating(chapterId);
    try {
      const allCodex = await db.codex.where('projectId').equals(projectId).toArray();
      const bibleRules = await db.bible.where('projectId').equals(projectId).toArray();
      const allChapters = await db.chapters.where('projectId').equals(projectId).sortBy('order');
      const currentChapter = allChapters.find(c => c.id === chapterId);
      const currentOrder = currentChapter ? currentChapter.order : 0;
      
      const projectContext = allChapters
        .filter(c => Math.abs(c.order - currentOrder) <= 3)
        .map(c => {
          let summary = c.summary || 'None';
          if (summary.length > 200) {
            summary = summary.substring(0, 200) + '...';
          }
          return `Chapter: ${c.title}\nSummary: ${summary}`;
        }).join('\n\n');

      const prompt = `Based on the overall story outline:\n\n${projectContext}\n\nPlease generate a bulleted list of 3-5 scene beats/plot points for the chapter titled "${currentTitle}". Keep it concise and focus on advancing the plot. Avoid mentioning that you are an AI. Only output the beats.`;

      const reply = await processChat({
        message: prompt,
        history: [],
        bibleRules,
        codexEntries: allCodex,
        contextText: ""
      });

      const newSummary = (currentSummary ? currentSummary + '\n\n' : '') + reply;
      await db.chapters.update(chapterId, { summary: newSummary });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate beats.');
    } finally {
      setIsGenerating(null);
    }
  };

  return { generateBeats, isGenerating };
}
