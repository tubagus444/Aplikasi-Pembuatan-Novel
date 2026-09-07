import { describe, it, expect } from 'vitest';
import {
  findParentMap,
  findBreadcrumbChain,
  buildMapHierarchy,
  getSubMapSummary,
} from './atlasHierarchy';
import { AtlasMap, MapMarker } from '@/src/types';

describe('atlasHierarchy', () => {
  const now = Date.now();
  const dummyBlob = new Blob();
  const mockMaps: AtlasMap[] = [
    { id: 1, projectId: 10, name: 'Peta Dunia Aetheria', width: 2000, height: 1500, createdAt: now, imageBlob: dummyBlob },
    { id: 2, projectId: 10, name: 'Benua Valoria', width: 1600, height: 1200, createdAt: now, imageBlob: dummyBlob },
    { id: 3, projectId: 10, name: 'Kota Pelabuhan Sunhaven', width: 1000, height: 800, createdAt: now, imageBlob: dummyBlob },
    { id: 4, projectId: 10, name: 'Kepulauan Mistika (Mandiri)', width: 800, height: 600, createdAt: now, imageBlob: dummyBlob },
  ];

  const mockMarkers: MapMarker[] = [
    // Di Peta Dunia (id: 1) ada area yang menaut ke Benua Valoria (id: 2)
    {
      id: 101,
      projectId: 10,
      mapId: 1,
      kind: 'area',
      title: 'Wilayah Benua Valoria',
      geometry: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.3, y: 0.4 }],
      linkedMapId: 2,
      createdAt: now,
    },
    // Di Benua Valoria (id: 2) ada pin yang menaut ke Kota Sunhaven (id: 3)
    {
      id: 201,
      projectId: 10,
      mapId: 2,
      kind: 'pin',
      title: 'Pelabuhan Sunhaven',
      geometry: { x: 0.5, y: 0.6 },
      linkedMapId: 3,
      createdAt: now,
    },
    // Penanda biasa di Kota Sunhaven (id: 3)
    {
      id: 301,
      projectId: 10,
      mapId: 3,
      kind: 'pin',
      title: 'Mercusuar Kuno',
      geometry: { x: 0.2, y: 0.3 },
      createdAt: now,
    },
    {
      id: 302,
      projectId: 10,
      mapId: 3,
      kind: 'route',
      title: 'Jalan Dermaga Utama',
      geometry: [{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 }],
      createdAt: now,
    },
    // Penanda di Kepulauan Mistika (id: 4)
    {
      id: 401,
      projectId: 10,
      mapId: 4,
      kind: 'pin',
      title: 'Kuil Kabut',
      geometry: { x: 0.5, y: 0.5 },
      createdAt: now,
    },
  ];

  describe('findParentMap', () => {
    it('returns parent map and linking marker for a child sub-map', () => {
      const res = findParentMap(3, mockMaps, mockMarkers);
      expect(res).not.toBeNull();
      expect(res?.parentMap.id).toBe(2);
      expect(res?.parentMap.name).toBe('Benua Valoria');
      expect(res?.parentMarker.id).toBe(201);
      expect(res?.parentMarker.title).toBe('Pelabuhan Sunhaven');
    });

    it('returns parent map for level-1 sub-map', () => {
      const res = findParentMap(2, mockMaps, mockMarkers);
      expect(res).not.toBeNull();
      expect(res?.parentMap.id).toBe(1);
      expect(res?.parentMarker.id).toBe(101);
    });

    it('returns null for root map or standalone map', () => {
      expect(findParentMap(1, mockMaps, mockMarkers)).toBeNull();
      expect(findParentMap(4, mockMaps, mockMarkers)).toBeNull();
    });
  });

  describe('findBreadcrumbChain', () => {
    it('constructs correct multi-level breadcrumb chain with fromMarkerId', () => {
      const chain = findBreadcrumbChain(3, mockMaps, mockMarkers);
      expect(chain).toEqual([
        { id: 1, name: 'Peta Dunia Aetheria', fromMarkerId: 101 },
        { id: 2, name: 'Benua Valoria', fromMarkerId: 201 },
      ]);
    });

    it('constructs 1-level breadcrumb chain for level-1 sub-map', () => {
      const chain = findBreadcrumbChain(2, mockMaps, mockMarkers);
      expect(chain).toEqual([
        { id: 1, name: 'Peta Dunia Aetheria', fromMarkerId: 101 },
      ]);
    });

    it('returns empty array for root map', () => {
      const chain = findBreadcrumbChain(1, mockMaps, mockMarkers);
      expect(chain).toEqual([]);
    });

    it('handles cyclic links gracefully without infinite looping', () => {
      // Map 1 links to Map 2, Map 2 links to Map 1
      const cyclicMarkers: MapMarker[] = [
        { id: 10, projectId: 10, createdAt: now, mapId: 1, kind: 'pin', geometry: { x: 0, y: 0 }, linkedMapId: 2 },
        { id: 20, projectId: 10, createdAt: now, mapId: 2, kind: 'pin', geometry: { x: 0, y: 0 }, linkedMapId: 1 },
      ];
      const chain = findBreadcrumbChain(2, mockMaps, cyclicMarkers);
      expect(chain.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buildMapHierarchy', () => {
    it('builds hierarchy tree correctly with roots and nested sub-maps', () => {
      const { roots, cycleDetected } = buildMapHierarchy(mockMaps, mockMarkers);
      expect(cycleDetected).toBe(false);

      // Root maps are Peta Dunia (id: 1) and Kepulauan Mistika (id: 4)
      expect(roots.length).toBe(2);

      const worldRoot = roots.find((r) => r.map.id === 1);
      expect(worldRoot).toBeDefined();
      expect(worldRoot?.children.length).toBe(1);

      const valoriaChild = worldRoot?.children[0];
      expect(valoriaChild?.map.id).toBe(2);
      expect(valoriaChild?.markerId).toBe(101);
      expect(valoriaChild?.children.length).toBe(1);

      const sunhavenChild = valoriaChild?.children[0];
      expect(sunhavenChild?.map.id).toBe(3);
      expect(sunhavenChild?.markerId).toBe(201);
      expect(sunhavenChild?.children.length).toBe(0);

      const mistikaRoot = roots.find((r) => r.map.id === 4);
      expect(mistikaRoot).toBeDefined();
      expect(mistikaRoot?.children.length).toBe(0);
    });

    it('detects cycle in map hierarchy', () => {
      const cyclicMarkers: MapMarker[] = [
        { id: 10, projectId: 10, createdAt: now, mapId: 1, kind: 'pin', geometry: { x: 0, y: 0 }, linkedMapId: 2 },
        { id: 20, projectId: 10, createdAt: now, mapId: 2, kind: 'pin', geometry: { x: 0, y: 0 }, linkedMapId: 1 },
      ];
      const { cycleDetected } = buildMapHierarchy(mockMaps, cyclicMarkers);
      expect(cycleDetected).toBe(true);
    });
  });

  describe('getSubMapSummary', () => {
    it('calculates counts correctly for a target sub-map', () => {
      const summary = getSubMapSummary(3, mockMaps, mockMarkers);
      expect(summary).not.toBeNull();
      expect(summary?.map.name).toBe('Kota Pelabuhan Sunhaven');
      expect(summary?.markerCount).toBe(2);
      expect(summary?.pinCount).toBe(1);
      expect(summary?.areaCount).toBe(0);
      expect(summary?.routeCount).toBe(1);
      expect(summary?.childMapCount).toBe(0);
    });

    it('returns null for non-existent map id', () => {
      expect(getSubMapSummary(999, mockMaps, mockMarkers)).toBeNull();
    });
  });
});
