import { describe, it, expect } from 'vitest';
import { analyzeRegions, findOrphanMarkers, getMarkerFirstAppearanceChapter } from './atlasAnalytics';
import { MapMarker, CodexEntry } from '@/src/types';
import { PresenceIndex } from './continuity';

describe('Atlas Analytics - analyzeRegions', () => {
  it('seharusnya menghitung kemunculan berdasarkan area faksi dan pin di dalamnya', () => {
    // Mock Data
    const markers: MapMarker[] = [
      {
        id: 1,
        projectId: 1,
        mapId: 1,
        kind: 'area',
        // Bentuk kotak sederhana: (0,0) -> (10,0) -> (10,10) -> (0,10)
        geometry: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
        codexId: 100, // Merujuk ke Kerajaan Utara
        createdAt: 0
      },
      {
        id: 2,
        projectId: 1,
        mapId: 1,
        kind: 'pin',
        // Titik ini ada di dalam kotak (Area 1)
        geometry: { x: 5, y: 5 },
        codexId: 200, // Merujuk ke Protagonis
        createdAt: 0
      },
      {
        id: 3,
        projectId: 1,
        mapId: 1,
        kind: 'pin',
        // Titik ini di LUAR kotak (Area 1)
        geometry: { x: 15, y: 15 },
        codexId: 300, // Merujuk ke Antagonis
        createdAt: 0
      }
    ];

    const codexEntries: CodexEntry[] = [
      { id: 100, projectId: 1, name: 'Kerajaan Utara', aliases: [], category: 'location', description: '', tags: [] },
      { id: 200, projectId: 1, name: 'Protagonis', aliases: [], category: 'character', description: '', tags: [] },
      { id: 300, projectId: 1, name: 'Antagonis', aliases: [], category: 'character', description: '', tags: [] },
    ];

    // Mock PresenceIndex
    // Kerajaan Utara disebut di Bab 0, Protagonis di Bab 0 & 1, Antagonis di Bab 2.
    const byEntity = new Map<number, { indices: number[]; mentions: number }>();
    byEntity.set(100, { indices: [0], mentions: 2 });     // Kerajaan Utara: 2x di Bab 0
    byEntity.set(200, { indices: [0, 1], mentions: 5 });  // Protagonis: 5x di Bab 0 dan 1
    byEntity.set(300, { indices: [2], mentions: 3 });     // Antagonis: 3x di Bab 2

    const presence: PresenceIndex = {
      perChapterCounts: [],
      byEntity
    };

    const result = analyzeRegions(markers, presence, codexEntries);

    expect(result.length).toBe(1); // Hanya ada 1 area
    const region = result[0];

    expect(region.areaName).toBe('Kerajaan Utara');
    
    // Harus mendeteksi 1 pin di dalam (Protagonis/id 2) dan mengabaikan pin di luar (Antagonis/id 3)
    expect(region.containedPins).toEqual([2]);

    // Bab terkait: Gabungan dari bab Kerajaan Utara (0) dan bab Protagonis (0, 1) = [0, 1].
    // Tidak boleh mengandung bab 2 karena Antagonis berada di luar area.
    expect(region.associatedChapters).toEqual([0, 1]);

    // Total sebutan: Kerajaan (2) + Protagonis (5) = 7
    expect(region.score).toBe(7);
  });

  it('seharusnya mendeteksi penanda yatim (belum pernah disebut atau unlinked)', () => {
    const markers: MapMarker[] = [
      { id: 1, projectId: 1, mapId: 1, kind: 'pin', geometry: { x: 1, y: 1 }, codexId: 100, createdAt: 0 },
      { id: 2, projectId: 1, mapId: 1, kind: 'pin', geometry: { x: 2, y: 2 }, codexId: 200, createdAt: 0 }, // Yatim (mentions = 0)
      { id: 3, projectId: 1, mapId: 1, kind: 'route', geometry: [{ x: 0, y: 0 }], title: 'Jalur Rahasia', createdAt: 0 }, // Yatim (unlinked)
      { id: 4, projectId: 1, mapId: 1, kind: 'area', geometry: [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }], codexId: 300, createdAt: 0 }, // Yatim area kosong
    ];

    const codexEntries: CodexEntry[] = [
      { id: 100, projectId: 1, name: 'Kota Aktif', aliases: [], category: 'location', description: '', tags: [] },
      { id: 200, projectId: 1, name: 'Kuil Terlupakan', aliases: [], category: 'location', description: '', tags: [] },
      { id: 300, projectId: 1, name: 'Hutan Sunyi', aliases: [], category: 'location', description: '', tags: [] },
    ];

    const byEntity = new Map<number, { indices: number[]; mentions: number }>();
    byEntity.set(100, { indices: [0, 2], mentions: 4 }); // Muncul di Bab 0 dan 2
    byEntity.set(200, { indices: [], mentions: 0 });     // Tidak pernah muncul
    byEntity.set(300, { indices: [], mentions: 0 });     // Tidak pernah muncul

    const presence: PresenceIndex = {
      perChapterCounts: [],
      byEntity
    };

    const orphans = findOrphanMarkers(markers, presence, codexEntries);
    expect(orphans).toHaveLength(3);

    const orphanIds = orphans.map(o => o.markerId);
    expect(orphanIds).toContain(2);
    expect(orphanIds).toContain(3);
    expect(orphanIds).toContain(4);
    expect(orphanIds).not.toContain(1);

    expect(orphans.find(o => o.markerId === 3)?.reason).toBe('unlinked');
    expect(orphans.find(o => o.markerId === 2)?.reason).toBe('never_mentioned');
  });

  it('seharusnya menghitung bab kemunculan pertama dengan benar', () => {
    const marker1: MapMarker = { id: 1, projectId: 1, mapId: 1, kind: 'pin', geometry: { x: 1, y: 1 }, codexId: 100, createdAt: 0 };
    const marker2: MapMarker = { id: 2, projectId: 1, mapId: 1, kind: 'pin', geometry: { x: 2, y: 2 }, codexId: 200, createdAt: 0 };

    const byEntity = new Map<number, { indices: number[]; mentions: number }>();
    byEntity.set(100, { indices: [2, 4], mentions: 2 }); // Indeks bab 2 -> Bab ke-3 (1-based)

    const presence: PresenceIndex = {
      perChapterCounts: [],
      byEntity
    };

    expect(getMarkerFirstAppearanceChapter(marker1, presence)).toBe(3);
    expect(getMarkerFirstAppearanceChapter(marker2, presence)).toBeNull();
  });
});
