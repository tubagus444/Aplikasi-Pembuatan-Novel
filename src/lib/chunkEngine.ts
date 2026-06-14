import { CodexEntry } from '@/src/types';

export interface Scene {
  index: number;
  content: string;
  wordCount: number;
}

export function splitIntoScenes(content: string): Scene[] {
  if (!content) return [];
  
  // Split by common scene breaks
  // 1. Explicit separators (***, ---)
  // 2. Three or more empty lines
  const rawScenes = content.split(/\n\s*\n\s*\n+|\n\s*(?:\*\*\*|---)\s*\n/);
  
  const scenes: Scene[] = [];
  rawScenes.forEach((sceneText, index) => {
    const trimmed = sceneText.trim();
    if (trimmed) {
      scenes.push({
        index,
        content: trimmed,
        wordCount: trimmed.split(/\s+/).filter(w => w.length > 0).length
      });
    }
  });

  if (scenes.length === 0 && content.trim()) {
    scenes.push({
        index: 0,
        content: content.trim(),
        wordCount: content.trim().split(/\s+/).filter(w => w.length > 0).length
    });
  }

  return scenes;
}

// Helper to count keyword occurrences
function countMatches(text: string, words: string[]): number {
  if (!text || words.length === 0) return 0;
  const lowerText = text.toLowerCase();
  return words.reduce((count, word) => {
    // Avoid regex injection issues; toleransi akhiran/partikel Indonesia (L1).
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}(?:nya|ku|mu|lah|kah|pun|toh)?\\b`, 'gi');
    const matches = lowerText.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

export function getRelevantScenes(query: string, scenes: Scene[], codexEntries: CodexEntry[]): Scene[] {
  if (!query || scenes.length === 0) return [];
  
  const lowerQuery = query.toLowerCase();
  
  // Extract keywords from query
  const queryWords = lowerQuery
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3); // Ignore short typical stop words

  // Gather character names/aliases from codex that actually appear in the query
  const relevantCodexWords: string[] = [];
  codexEntries.forEach(entry => {
    if (entry.name && lowerQuery.includes(entry.name.toLowerCase())) {
        relevantCodexWords.push(entry.name);
    }
    if (entry.aliases && Array.isArray(entry.aliases)) {
      entry.aliases.forEach(alias => {
          if (alias && lowerQuery.includes(alias.toLowerCase())) {
              relevantCodexWords.push(alias);
          }
      });
    }
  });

  const searchKeywords = Array.from(new Set([...queryWords, ...relevantCodexWords]));

  if (searchKeywords.length === 0) {
     return []; // Not enough confidence, fallback will handle
  }

  // Score scenes based on keyword occurrence
  const scoredScenes = scenes.map(scene => {
    const score = countMatches(scene.content, searchKeywords);
    // Add minor weight to recent scenes to break ties
    const indexWeight = scene.index * 0.001; 
    return { scene, score: score + indexWeight };
  });

  // Filter scenes with high enough score (threshold)
  const threshold = 0.5; // At least one partial/full match
  const relevantScored = scoredScenes.filter(s => s.score > threshold);

  if (relevantScored.length === 0) {
    return [];
  }

  relevantScored.sort((a, b) => b.score - a.score);
  
  // Return top 2 relevant scenes
  return relevantScored.slice(0, 2).map(s => s.scene).sort((a, b) => a.index - b.index); // Sort chronologically
}

export function getLastScene(scenes: Scene[]): Scene | null {
  if (scenes.length === 0) return null;
  return scenes[scenes.length - 1];
}

export function buildExcerptContext(scenes: Scene[]): string {
  if (scenes.length === 0) return '';
  
  const content = scenes.map(s => s.content).join('\n\n[...]\n\n');
  return `[CHAPTER EXCERPT]\n${content}\n[END EXCERPT]`;
}
