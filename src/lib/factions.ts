/**
 * Panel Faksi & Kelompok (#15) — logika turunan MURNI.
 *
 * Faksi = entri Codex ber-`factionTag` (jangkar). Anggota = entri Codex yang
 * `tags`-nya memuat `factionTag` (lintas-kategori). Hubungan antar-faksi punya DUA
 * sinyal netral, tanpa penghakiman:
 *   - DIDEKLARASIKAN: relasi langsung antar dua ENTRI faksi (kebenaran penulis).
 *   - DITURUNKAN: potret agregat relasi antar-ANGGOTA (deskriptif, bukan klaim).
 *
 * Semua deterministik, nol token, tak menyentuh DB/UI. Menumpang `tags` +
 * `relationships` + satu field inert `factionTag` (tak ada tabel/FK baru).
 */
import type { CodexEntry, Relationship } from '@/src/types';
import { RELATIONSHIP_TYPES } from '@/src/features/codex/relationshipTypes';

// Prioritas tipe (urutan sumber tunggal RELATIONSHIP_TYPES) untuk memilih tipe
// "primer" saat sebuah pasangan/sentimen punya beberapa tipe. Tak dikenal = paling rendah.
const TYPE_PRIORITY = new Map(RELATIONSHIP_TYPES.map((t, i) => [t.value, i]));
const UNKNOWN_PRIORITY = RELATIONSHIP_TYPES.length;
const priorityOf = (type: string): number => TYPE_PRIORITY.get(type) ?? UNKNOWN_PRIORITY;

/** Kunci pasangan tak-berarah (id kecil dulu) agar (a,b)==(b,a). */
export function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export interface Faction {
  /** Id entri Codex jangkar. */
  id: number;
  name: string;
  /** Tag keanggotaan (dari `factionTag`, sudah di-trim). */
  tag: string;
  hidden: boolean;
  /** Id entri Codex yang menjadi anggota (tags memuat `tag`), terurut. */
  memberIds: number[];
}

export interface FactionPairStat {
  /** Id entri faksi (kecil). */
  aId: number;
  /** Id entri faksi (besar). */
  bId: number;
  /** Relasi langsung antar dua ENTRI faksi (deklarasi penulis). */
  declared: Relationship[];
  /** Tally relasi antar-ANGGOTA lintas kedua faksi, per tipe (potret). */
  derived: Record<string, number>;
}

export interface FactionRelationData {
  /** Semua pasangan yang punya deklarasi ATAU relasi anggota, terurut. */
  pairs: FactionPairStat[];
  /** Akses O(1) via `pairKey`. */
  pairMap: Map<string, FactionPairStat>;
  /** Per-faksi: tally relasi ANTAR-ANGGOTA sendiri (kohesi internal), per tipe. */
  internal: Map<number, Record<string, number>>;
}

/**
 * Bangun daftar faksi dari entri Codex. Faksi = entri ber-`factionTag` non-kosong;
 * anggotanya = entri yang `tags`-nya memuat tag itu (persis, setelah trim).
 */
export function buildFactions(entries: CodexEntry[]): Faction[] {
  const factions: Faction[] = [];
  for (const e of entries) {
    const tag = e.factionTag?.trim();
    if (!tag || e.id == null) continue;
    const memberIds = entries
      .filter(m => m.id != null && (m.tags ?? []).some(t => t.trim() === tag))
      .map(m => m.id!)
      .sort((x, y) => x - y);
    factions.push({ id: e.id, name: e.name, tag, hidden: !!e.hidden, memberIds });
  }
  return factions.sort((a, b) => a.name.localeCompare(b.name, 'id') || a.id - b.id);
}

function ensurePair(map: Map<string, FactionPairStat>, a: number, b: number): FactionPairStat {
  const key = pairKey(a, b);
  let p = map.get(key);
  if (!p) {
    const [aId, bId] = a < b ? [a, b] : [b, a];
    p = { aId, bId, declared: [], derived: {} };
    map.set(key, p);
  }
  return p;
}

/**
 * Agregasi hubungan antar-faksi (dideklarasikan + diturunkan) plus kohesi internal.
 * Deterministik. Sebuah entitas boleh jadi anggota banyak faksi (banyak tag).
 */
export function aggregateFactionRelations(
  factions: Faction[],
  relationships: Relationship[],
): FactionRelationData {
  const pairMap = new Map<string, FactionPairStat>();
  const internal = new Map<number, Record<string, number>>();
  const factionIds = new Set(factions.map(f => f.id));

  // Peta: id entitas → himpunan id faksi yang beranggotakan dia.
  const memberFactions = new Map<number, Set<number>>();
  for (const f of factions) {
    for (const mid of f.memberIds) {
      let set = memberFactions.get(mid);
      if (!set) { set = new Set(); memberFactions.set(mid, set); }
      set.add(f.id);
    }
  }

  const bumpInternal = (fid: number, type: string) => {
    let rec = internal.get(fid);
    if (!rec) { rec = {}; internal.set(fid, rec); }
    rec[type] = (rec[type] ?? 0) + 1;
  };

  for (const r of relationships) {
    // (1) DIDEKLARASIKAN — relasi langsung antara dua entri faksi.
    if (r.sourceId !== r.targetId && factionIds.has(r.sourceId) && factionIds.has(r.targetId)) {
      ensurePair(pairMap, r.sourceId, r.targetId).declared.push(r);
    }

    // (2) DITURUNKAN — relasi antar-anggota.
    const srcSet = memberFactions.get(r.sourceId);
    const tgtSet = memberFactions.get(r.targetId);
    if (!srcSet || !tgtSet) continue;

    // Internal: faksi yang memuat KEDUA ujung (irisan) → satu hitung per faksi.
    for (const fid of srcSet) {
      if (tgtSet.has(fid)) bumpInternal(fid, r.type);
    }
    // Lintas-faksi: pasangan tak-berarah unik per relasi (dedup agar tak ganda).
    const seen = new Set<string>();
    for (const fa of srcSet) {
      for (const fb of tgtSet) {
        if (fa === fb) continue;
        const key = pairKey(fa, fb);
        if (seen.has(key)) continue;
        seen.add(key);
        const p = ensurePair(pairMap, fa, fb);
        p.derived[r.type] = (p.derived[r.type] ?? 0) + 1;
      }
    }
  }

  const pairs = [...pairMap.values()].sort((x, y) => x.aId - y.aId || x.bId - y.bId);
  return { pairs, pairMap, internal };
}

export interface FactionSentiment {
  /** Sumber sentimen yang ditampilkan: deklarasi menang bila ada. */
  source: 'declared' | 'derived' | 'none';
  /** Tipe relasi primer (untuk warna/label); undefined bila `none`. */
  type?: string;
  /** Jumlah relasi anggota yang mendasari `derived` (0 bila tak ada). */
  memberRelations: number;
}

/**
 * Sentimen "utama" sebuah pasangan faksi untuk pewarnaan sel matriks/daftar:
 * deklarasi (tipe berprioritas tertinggi) bila ada, else tipe turunan dominan.
 * TIDAK menghakimi ketidakcocokan — panel menampilkan kedua angka apa adanya.
 */
export function factionPairSentiment(stat: FactionPairStat | undefined): FactionSentiment {
  const memberRelations = stat ? Object.values(stat.derived).reduce((s, n) => s + n, 0) : 0;
  if (!stat) return { source: 'none', memberRelations: 0 };

  if (stat.declared.length > 0) {
    const type = [...stat.declared]
      .map(r => r.type)
      .sort((a, b) => priorityOf(a) - priorityOf(b))[0];
    return { source: 'declared', type, memberRelations };
  }

  const entries = Object.entries(stat.derived);
  if (entries.length > 0) {
    // Dominan = jumlah terbanyak; seri → prioritas RELATIONSHIP_TYPES.
    const type = entries.sort((a, b) => b[1] - a[1] || priorityOf(a[0]) - priorityOf(b[0]))[0][0];
    return { source: 'derived', type, memberRelations };
  }

  return { source: 'none', memberRelations: 0 };
}
