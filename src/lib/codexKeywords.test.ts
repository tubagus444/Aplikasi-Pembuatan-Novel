import { describe, it, expect } from 'vitest';
import { extractCodexAcKeywords } from './codexKeywords';
import { CodexEntry } from '@/src/types';

function makeEntry(id: number, name: string, aliases: string[] = []): CodexEntry {
  return { id, name, aliases, category: 'character', projectId: 1, description: '' } as CodexEntry;
}

describe('extractCodexAcKeywords', () => {
  it('extracts name and aliases with data mapper', () => {
    const entries = [makeEntry(1, 'Kael', ['The Shadow'])];
    const kw = extractCodexAcKeywords(entries, (e) => e.id!);
    expect(kw).toEqual([
      { word: 'Kael', data: 1 },
      { word: 'The Shadow', data: 1 },
    ]);
  });

  it('filters terms shorter than 2 characters', () => {
    const entries = [makeEntry(1, 'A', ['Bo', 'C'])];
    const kw = extractCodexAcKeywords(entries, (e) => e.id!);
    // 'A' (1 char) and 'C' (1 char) should be filtered out; 'Bo' (2 chars) stays
    expect(kw).toEqual([{ word: 'Bo', data: 1 }]);
  });

  it('trims whitespace from terms', () => {
    const entries = [makeEntry(1, '  Kael  ', ['  Ren  '])];
    const kw = extractCodexAcKeywords(entries, (e) => e.id!);
    expect(kw).toEqual([
      { word: 'Kael', data: 1 },
      { word: 'Ren', data: 1 },
    ]);
  });

  it('skips entries without id', () => {
    const entries = [{ name: 'Ghost', aliases: [], category: 'character', projectId: 1, description: '' } as CodexEntry];
    const kw = extractCodexAcKeywords(entries, (e) => e.id!);
    expect(kw).toEqual([]);
  });

  it('passes isAlias flag to data mapper', () => {
    const entries = [makeEntry(1, 'Kael', ['Shadow'])];
    const kw = extractCodexAcKeywords(entries, (e, isAlias) => ({ id: e.id!, isAlias }));
    expect(kw).toEqual([
      { word: 'Kael', data: { id: 1, isAlias: false } },
      { word: 'Shadow', data: { id: 1, isAlias: true } },
    ]);
  });

  it('handles entries with empty/null aliases', () => {
    const entries = [makeEntry(1, 'Kael', ['', undefined as any, 'Ren'])];
    const kw = extractCodexAcKeywords(entries, (e) => e.id!);
    expect(kw).toEqual([
      { word: 'Kael', data: 1 },
      { word: 'Ren', data: 1 },
    ]);
  });

  it('handles empty entries array', () => {
    const kw = extractCodexAcKeywords([], (e) => e.id!);
    expect(kw).toEqual([]);
  });
});
