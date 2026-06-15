/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sumber kebenaran tunggal untuk pilihan Story Bible (genre/tone/POV/pacing).
 * Dipakai bersama oleh BiblePanel (UI) dan lapisan AI (`services/ai/index.ts`),
 * sehingga nilai yang tersimpan sebagai slug/JSON dapat dipetakan kembali ke
 * label manusiawi sebelum dikirim ke model — bukan slug mentah seperti
 * `3rd-limited` atau `["epic","dark"]`.
 */

export interface BibleOption {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
}

export const GENRES: BibleOption[] = [
  { id: 'epic', label: 'Epic Fantasy', icon: '⚔️' },
  { id: 'dark', label: 'Dark Fantasy', icon: '🌑' },
  { id: 'urban', label: 'Urban Fantasy', icon: '🏙️' },
  { id: 'high', label: 'High Fantasy', icon: '🏰' },
  { id: 'low', label: 'Low Fantasy', icon: '🗡️' },
  { id: 'mythpunk', label: 'Mythpunk', icon: '🌀' },
  { id: 'grimdark', label: 'Grimdark', icon: '💀' },
  { id: 'cozy', label: 'Cozy Fantasy', icon: '☕' },
  { id: 'portal', label: 'Portal Fantasy', icon: '🚪' },
  { id: 'flintlock', label: 'Flintlock', icon: '🔫' },
  { id: 'progression', label: 'Progression', icon: '📈' },
  { id: 'romantasy', label: 'Romantasy', icon: '🌹' },
];

export const TONES: BibleOption[] = [
  { id: 'epik', label: 'Epik', icon: '⚡' },
  { id: 'gelap', label: 'Gelap', icon: '🔮' },
  { id: 'whimsical', label: 'Whimsical', icon: '🦋' },
  { id: 'tragis', label: 'Tragis', icon: '💔' },
  { id: 'penuh-harap', label: 'Penuh Harap', icon: '🌅' },
  { id: 'misterius', label: 'Misterius', icon: '📓' },
  { id: 'humoris', label: 'Humoris', icon: '🤩' },
  { id: 'realistis', label: 'Realistis', icon: '🌧️' },
  { id: 'romantis', label: 'Romantis', icon: '🌹' },
];

export const POVS: BibleOption[] = [
  { id: '1st-single', label: 'Orang Pertama Tunggal', desc: '"Aku berjalan ke..."' },
  { id: '1st-plural', label: 'Orang Pertama Jamak', desc: '"Kami berjalan ke..."' },
  { id: '3rd-limited', label: 'Orang Ketiga Terbatas', desc: 'Mengikuti satu karakter' },
  { id: '3rd-omniscient', label: 'Orang Ketiga Omniscient', desc: 'Semua perspektif' },
  { id: '2nd', label: 'Orang Kedua', desc: '"Kamu berjalan ke..."' },
  { id: 'multi', label: 'Multi-POV', desc: 'Bergantian antar karakter' },
];

export const PACINGS: BibleOption[] = [
  { id: 'slow', label: 'Slow Burn', desc: 'Membangun perlahan, kaya detail' },
  { id: 'balanced', label: 'Seimbang', desc: 'Campuran aksi dan refleksi' },
  { id: 'fast', label: 'Bergerak Cepat', desc: 'Aksi terus menerus' },
  { id: 'episodic', label: 'Episodik', desc: 'Cerita dalam cerita' },
];

const toLabelMap = (opts: BibleOption[]): Record<string, string> =>
  Object.fromEntries(opts.map(o => [o.id, o.label]));

const GENRE_LABELS = toLabelMap(GENRES);
const TONE_LABELS = toLabelMap(TONES);
const POV_LABELS = toLabelMap(POVS);
const PACING_LABELS = toLabelMap(PACINGS);

/** Label manusiawi untuk setiap key bible (dipakai sebagai prefiks baris konteks AI). */
export const BIBLE_KEY_LABELS: Record<string, string> = {
  __STORY_TITLE__: 'Judul',
  __STORY_TAGLINE__: 'Tagline',
  __CORE_PREMISE__: 'Premis',
  __WORLD_SETTING__: 'Latar/Setting',
  __THEMES__: 'Tema',
  __GENRES__: 'Genre',
  __TONES__: 'Nada/Tone',
  __POV__: 'Sudut Pandang',
  __PACING__: 'Kecepatan Alur',
  __AUTHOR_NOTES__: 'Catatan Penulis',
  __TARGET_AUDIENCE__: 'Target Pembaca',
};

/** Memetakan JSON array slug → daftar label, dipisah koma. */
function decodeIdList(instruction: string, labels: Record<string, string>): string {
  try {
    const ids = JSON.parse(instruction);
    if (Array.isArray(ids)) {
      return ids.map((id: string) => labels[id] || id).join(', ');
    }
  } catch {
    /* bukan JSON valid — kembalikan apa adanya di bawah */
  }
  return instruction;
}

/** Mengubah nilai mentah (slug/JSON) sebuah rule bible menjadi teks manusiawi. */
export function formatBibleInstruction(key: string, instruction: string): string {
  switch (key) {
    case '__GENRES__': return decodeIdList(instruction, GENRE_LABELS);
    case '__TONES__': return decodeIdList(instruction, TONE_LABELS);
    case '__POV__': return POV_LABELS[instruction] || instruction;
    case '__PACING__': return PACING_LABELS[instruction] || instruction;
    default: return instruction;
  }
}

/**
 * Plafon panjang nilai (char) yang dikirim ke AI per-key — jaring pengaman, bukan
 * target. HANYA membatasi payload AI; penyimpanan Dexie tetap utuh. Catatan Penulis
 * adalah field bebas yang bisa membengkak; dipangkas agar tak membayar penuh tiap
 * cache bust. Taruh directive kritis di awal (atau di Premis/Tema yang tak dibatasi).
 */
const BIBLE_AI_MAX_CHARS: Record<string, number> = {
  __AUTHOR_NOTES__: 2000,
};

function capForAI(key: string, value: string): string {
  const max = BIBLE_AI_MAX_CHARS[key];
  return max && value.length > max ? value.slice(0, max) + '…' : value;
}

/** Membangun satu baris konteks bible yang siap dikirim ke AI: `Label: nilai`. */
export function formatBibleRuleLine(key: string, instruction: string): string {
  const label = BIBLE_KEY_LABELS[key] || key.replace(/__/g, '');
  return `${label}: ${capForAI(key, formatBibleInstruction(key, instruction))}`;
}

/**
 * True bila rule punya nilai bermakna setelah diformat. Menangkap baris kosong
 * (`''`) maupun array kosong yang tersimpan sebagai `"[]"` — keduanya tak perlu
 * dikirim ke AI (buang token + noise).
 */
export function hasBibleValue(key: string, instruction: string): boolean {
  return formatBibleInstruction(key, instruction).trim().length > 0;
}

/**
 * Memformat sekumpulan rule bible menjadi blok teks siap-AI: membuang baris
 * kosong lalu menggabungkan tiap baris `Label: nilai`. Mengembalikan '' bila
 * tak ada nilai bermakna (pemanggil yang memutuskan teks fallback).
 */
export function formatBibleBlock(rules: { key: string; instruction: string }[]): string {
  return rules
    .filter(r => hasBibleValue(r.key, r.instruction))
    .map(r => formatBibleRuleLine(r.key, r.instruction))
    .join('\n');
}
