/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeProse,
  detectEchoWords,
  detectProximityEchoes,
  dialogueRatio,
  buildProseReport,
  ProseChapter,
  tokenizeChapter,
} from './proseAnalysis';

describe('analyzeProse', () => {
  it('mengembalikan metrik nol untuk teks kosong', () => {
    const m = analyzeProse('', 'id');
    expect(m.wordCount).toBe(0);
    expect(m.sentenceCount).toBe(0);
    expect(m.readabilityScore).toBe(0);
  });

  it('menghitung jumlah kata & kalimat', () => {
    const m = analyzeProse('Dia berlari cepat. Langit gelap.', 'id');
    expect(m.wordCount).toBe(5);
    expect(m.sentenceCount).toBe(2);
  });

  it('menandai kalimat panjang (>25 kata)', () => {
    const longSentence = Array.from({ length: 30 }, (_, i) => `kata${i}`).join(' ') + '.';
    const m = analyzeProse(longSentence, 'id');
    expect(m.longSentences).toBe(1);
  });

  it('mendeteksi verba pasif Indonesia (di-/ter-)', () => {
    const m = analyzeProse('Pintu itu dibuka dan dia terjatuh.', 'id');
    expect(m.passiveVoiceCount).toBeGreaterThanOrEqual(2);
  });

  it('tidak salah menandai superlatif ter- sebagai pasif', () => {
    const m = analyzeProse('Dia pelari terbaik dan tercepat.', 'id');
    expect(m.passiveVoiceCount).toBe(0);
  });

  it('mendeteksi adverbia Indonesia', () => {
    const m = analyzeProse('Dia sangat lelah dan hampir menyerah.', 'id');
    expect(m.adverbCount).toBe(2);
  });

  it('mendeteksi adverbia -ly & pasif Inggris', () => {
    const m = analyzeProse('The door was opened quietly.', 'en');
    expect(m.adverbCount).toBe(1); // quietly
    expect(m.passiveVoiceCount).toBe(1); // was opened
  });
});

describe('detectEchoWords', () => {
  const chapters = [
    { id: 1, title: 'Bab 1', content: 'bayangan bergerak. bayangan itu dingin. bayangan menari.' },
    { id: 2, title: 'Bab 2', content: 'bayangan kembali. angin bertiup. bayangan bergerak lagi.' },
  ].map(tokenizeChapter);

  it('menemukan kata muleti lintas-bab', () => {
    const echoes = detectEchoWords(chapters, { language: 'id', minTotal: 3 });
    const top = echoes[0];
    expect(top.word).toBe('bayangan');
    expect(top.total).toBe(5);
    expect(top.chapters).toBe(2);
  });

  it('menghormati minTotal', () => {
    const echoes = detectEchoWords(chapters, { language: 'id', minTotal: 6 });
    expect(echoes.find((e) => e.word === 'bayangan')).toBeUndefined();
  });

  it('mengecualikan stopword & kata pendek', () => {
    const echoes = detectEchoWords(chapters, { language: 'id', minTotal: 1 });
    expect(echoes.find((e) => e.word === 'itu')).toBeUndefined(); // stopword
    expect(echoes.find((e) => e.word === 'lagi')).toBeUndefined(); // stopword
  });

  it('mengecualikan kata dari excludeWords (mis. nama Codex)', () => {
    const echoes = detectEchoWords(chapters, {
      language: 'id',
      minTotal: 3,
      excludeWords: new Set(['bayangan']),
    });
    expect(echoes.find((e) => e.word === 'bayangan')).toBeUndefined();
  });
});

describe('detectProximityEchoes', () => {
  it('menandai kata sama yang berdekatan', () => {
    const chapters = [
      { id: 1, title: 'Bab 1', content: 'Dia menatap jendela. Ibunya juga sedang menatap ke arah sama.' },
    ].map(tokenizeChapter);
    const echoes = detectProximityEchoes(chapters, { language: 'id', window: 40 });
    const hit = echoes.find((e) => e.word === 'menatap');
    expect(hit).toBeDefined();
    expect(hit!.distance).toBeGreaterThan(0);
    expect(hit!.excerpt.toLowerCase()).toContain('menatap');
    expect(hit!.chapterId).toBe(1);
  });

  it('mengabaikan pengulangan yang berjauhan (di luar jendela)', () => {
    const filler = Array.from({ length: 60 }, (_, i) => `kata${i}`).join(' ');
    const chapters = [
      { id: 1, title: 'Bab 1', content: `menatap ${filler} menatap` },
    ].map(tokenizeChapter);
    const echoes = detectProximityEchoes(chapters, { language: 'id', window: 40 });
    expect(echoes.find((e) => e.word === 'menatap')).toBeUndefined();
  });

  it('tidak menandai stopword walau berdekatan', () => {
    const chapters = [
      { id: 1, title: 'Bab 1', content: 'yang ini yang itu' },
    ].map(tokenizeChapter);
    const echoes = detectProximityEchoes(chapters, { language: 'id' });
    expect(echoes.find((e) => e.word === 'yang')).toBeUndefined();
  });

  it('mengurutkan menurut jarak menaik', () => {
    const chapters = [
      { id: 1, title: 'Bab 1', content: 'kastil megah kastil. lembah hijau nan luas indah subur lembah.' },
    ].map(tokenizeChapter);
    const echoes = detectProximityEchoes(chapters, { language: 'id', window: 40 });
    expect(echoes.length).toBeGreaterThanOrEqual(2);
    expect(echoes[0].distance).toBeLessThanOrEqual(echoes[1].distance);
  });

  it('menghormati excludeWords', () => {
    const chapters = [
      { id: 1, title: 'Bab 1', content: 'Rania menatap Rania sekali lagi.' },
    ].map(tokenizeChapter);
    const echoes = detectProximityEchoes(chapters, {
      language: 'id',
      excludeWords: new Set(['rania']),
    });
    expect(echoes.find((e) => e.word === 'rania')).toBeUndefined();
  });
});

describe('dialogueRatio', () => {
  it('nol tanpa dialog', () => {
    expect(dialogueRatio('Langit gelap dan sunyi.')).toBe(0);
  });

  it('menghitung porsi kata dalam kutip lurus', () => {
    // 2 kata dalam kutip dari 5 total kata.
    const r = dialogueRatio('Dia berkata "ayo pergi" sekarang.');
    expect(r).toBeCloseTo(2 / 5, 5);
  });

  it('mendukung kutip melengkung', () => {
    const r = dialogueRatio('Dia berkata “ayo pergi” sekarang.');
    expect(r).toBeCloseTo(2 / 5, 5);
  });
});

describe('buildProseReport', () => {
  const chapters = [
    { id: 1, title: 'Bab 1', content: 'Dia berlari. "Cepat!" katanya.' },
    { id: 2, title: 'Bab 2', content: 'Malam tiba. Angin dingin bertiup pelan.' },
  ].map(tokenizeChapter);

  it('mengagregasi metrik seluruh naskah', () => {
    const report = buildProseReport(chapters, 'id');
    expect(report.chapterCount).toBe(2);
    expect(report.chapters).toHaveLength(2);
    expect(report.totalWords).toBeGreaterThan(0);
    expect(report.avgReadability).toBeGreaterThanOrEqual(0);
    expect(report.avgReadability).toBeLessThanOrEqual(100);
    expect(report.chapters[0].index).toBe(0);
  });

  it('meneruskan excludeWords ke echo words', () => {
    const many = [
      { id: 1, title: 'B1', content: 'kastil kastil kastil kastil kastil kastil kastil' },
    ].map(tokenizeChapter);
    const report = buildProseReport(many, 'id', new Set(['kastil']));
    expect(report.echoWords.find((e) => e.word === 'kastil')).toBeUndefined();
  });
});
