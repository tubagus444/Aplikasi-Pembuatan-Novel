/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Atlas Analytics — layer murni (tanpa tabel baru/komponen UI) untuk menghitung
 * analitik peta dunia, seperti "Bab/Adegan apa saja yang terjadi di Region X".
 * Diturunkan dengan menyilangkan geometri MapMarker (pointInPolygon) dengan PresenceIndex.
 */

import { MapMarker, MapPoint, CodexEntry } from '@/src/types';
import { PresenceIndex } from '@/src/lib/continuity';
import { pointInPolygon, isPointGeometry } from '@/src/lib/mapGeometry';

export interface RegionAnalytic {
  /** ID dari penanda tipe 'area' */
  markerId: number;
  /** Nama area (diambil dari Codex bila tertaut, fallback ke title) */
  areaName: string;
  /** Tautan ke entri Codex (misalnya entri Faksi/Kerajaan) jika ada */
  codexId?: number;
  /** ID dari marker tipe 'pin' (karakter/item) yang koordinatnya berada di dalam poligon area ini */
  containedPins: number[];
  /** Array unik dan terurut (ascending) dari indeks bab yang terkait dengan area ini */
  associatedChapters: number[];
  /** Total sebutan gabungan (dari area itu sendiri maupun pin-pin di dalamnya) */
  score: number;
}

/**
 * Menghitung analitik "Adegan per Wilayah" dengan menyilangkan data wilayah pada peta,
 * pin karakter/benda yang berada di dalamnya, dengan data kehadiran lintasan (PresenceIndex).
 * 
 * @param markers Daftar penanda (area, pin, rute) dari satu peta (AtlasMap).
 * @param presence Indeks kehadiran hasil dari `buildPresenceIndexAsync`.
 * @param codexEntries Seluruh daftar entri Codex untuk resolusi nama.
 */
export function analyzeRegions(
  markers: MapMarker[],
  presence: PresenceIndex,
  codexEntries: CodexEntry[]
): RegionAnalytic[] {
  const areas = markers.filter(m => m.kind === 'area' && Array.isArray(m.geometry));
  const pins = markers.filter(m => m.kind === 'pin' && isPointGeometry(m.geometry));

  const codexMap = new Map<number, CodexEntry>();
  for (const entry of codexEntries) {
    if (entry.id !== undefined) codexMap.set(entry.id, entry);
  }

  return areas.map(area => {
    const poly = area.geometry as MapPoint[];
    // Hitung pin apa saja yang "jatuh" ke dalam perbatasan wilayah ini
    const containedPins = pins.filter(pin => pointInPolygon(pin.geometry as MapPoint, poly));
    
    const chapterSet = new Set<number>();
    let score = 0;

    // 1. Aktivitas Area itu sendiri (jika area ini merujuk ke entri Faksi/Negara)
    if (area.codexId) {
      const p = presence.byEntity.get(area.codexId);
      if (p) {
        p.indices.forEach(idx => chapterSet.add(idx));
        score += p.mentions;
      }
    }

    // 2. Aktivitas Karakter/Pin yang ada di dalam Area
    for (const pin of containedPins) {
      if (pin.codexId) {
        const p = presence.byEntity.get(pin.codexId);
        if (p) {
          p.indices.forEach(idx => chapterSet.add(idx));
          score += p.mentions;
        }
      }
    }

    // Resolusi penamaan: Prioritas Codex -> Fallback ke judul marker -> Fallback statis
    let areaName = area.title || 'Area Tak Bernama';
    if (area.codexId) {
      const codexRef = codexMap.get(area.codexId);
      if (codexRef && codexRef.name) {
        areaName = codexRef.name;
      }
    }

    return {
      markerId: area.id || 0,
      areaName,
      codexId: area.codexId,
      containedPins: containedPins.map(p => p.id!).filter(id => id !== undefined),
      associatedChapters: Array.from(chapterSet).sort((a, b) => a - b),
      score
    };
  });
}
