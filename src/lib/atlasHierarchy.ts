/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Logika murni navigasi & hierarki peta bertingkat (Atlas Sub-Maps).
 * Nol dependency luar — sepenuhnya deterministik dan dapat diuji unit.
 */

import { AtlasMap, MapMarker } from '@/src/types';

export interface MapHierarchyNode {
  map: AtlasMap;
  markerId?: number;
  markerTitle?: string;
  markerKind?: 'pin' | 'area' | 'route';
  children: MapHierarchyNode[];
  level: number;
}

export interface MapBreadcrumbItem {
  id: number;
  name: string;
  fromMarkerId?: number;
}

export interface SubMapSummary {
  map: AtlasMap;
  markerCount: number;
  pinCount: number;
  areaCount: number;
  routeCount: number;
  childMapCount: number;
}

/**
 * Mencari peta induk dan penanda asal dari sebuah sub-peta (jika ada).
 */
export function findParentMap(
  targetMapId: number,
  maps: AtlasMap[],
  allMarkers: MapMarker[],
): { parentMap: AtlasMap; parentMarker: MapMarker } | null {
  const mapById = new Map<number, AtlasMap>();
  for (const m of maps) {
    if (m.id != null) mapById.set(m.id, m);
  }

  // Cari penanda yang memiliki linkedMapId === targetMapId
  const parentMarker = allMarkers.find((mk) => mk.linkedMapId === targetMapId);
  if (!parentMarker || parentMarker.mapId == null) return null;

  const parentMap = mapById.get(parentMarker.mapId);
  if (!parentMap) return null;

  return { parentMap, parentMarker };
}

/**
 * Membangun jejak remah roti (breadcrumb chain) dari peta akar hingga targetMapId.
 * Jika peta tidak memiliki induk, mengembalikan array kosong.
 * Jika memiliki induk, mengembalikan urutan dari akar -> induk -> ... -> target.
 */
export function findBreadcrumbChain(
  targetMapId: number,
  maps: AtlasMap[],
  allMarkers: MapMarker[],
): MapBreadcrumbItem[] {
  const chain: MapBreadcrumbItem[] = [];
  const visited = new Set<number>();
  let currentId = targetMapId;

  while (currentId != null && !visited.has(currentId)) {
    visited.add(currentId);
    const parentInfo = findParentMap(currentId, maps, allMarkers);
    if (!parentInfo || parentInfo.parentMap.id == null) break;

    chain.unshift({
      id: parentInfo.parentMap.id,
      name: parentInfo.parentMap.name,
      fromMarkerId: parentInfo.parentMarker.id,
    });

    currentId = parentInfo.parentMap.id;
  }

  return chain;
}

/**
 * Membangun pohon hierarki lengkap dari seluruh peta dalam proyek.
 * Mendeteksi siklus dan mengelompokkan peta akar vs berdiri sendiri.
 */
export function buildMapHierarchy(
  maps: AtlasMap[],
  allMarkers: MapMarker[],
): {
  roots: MapHierarchyNode[];
  allNodes: MapHierarchyNode[];
  cycleDetected: boolean;
} {
  const mapById = new Map<number, AtlasMap>();
  for (const m of maps) {
    if (m.id != null) mapById.set(m.id, m);
  }

  // Peta anak -> penanda yang menautkannya
  const childToParentMarker = new Map<number, MapMarker>();
  // Peta induk -> daftar penanda anak yang punya linkedMapId
  const parentToChildMarkers = new Map<number, MapMarker[]>();

  for (const mk of allMarkers) {
    if (mk.linkedMapId != null && mk.mapId != null) {
      if (!childToParentMarker.has(mk.linkedMapId)) {
        childToParentMarker.set(mk.linkedMapId, mk);
      }
      const list = parentToChildMarkers.get(mk.mapId) ?? [];
      list.push(mk);
      parentToChildMarkers.set(mk.mapId, list);
    }
  }

  let cycleDetected = false;
  const allNodes: MapHierarchyNode[] = [];
  const visitedGlobally = new Set<number>();

  function buildNode(
    map: AtlasMap,
    level: number,
    activePath: Set<number>,
    marker?: MapMarker,
  ): MapHierarchyNode {
    if (map.id != null && activePath.has(map.id)) {
      cycleDetected = true;
      return {
        map,
        markerId: marker?.id,
        markerTitle: marker?.title,
        markerKind: marker?.kind,
        children: [],
        level,
      };
    }

    if (map.id != null) {
      visitedGlobally.add(map.id);
    }

    const nextPath = new Set(activePath);
    if (map.id != null) nextPath.add(map.id);

    const childMarkers = map.id != null ? (parentToChildMarkers.get(map.id) ?? []) : [];
    const children: MapHierarchyNode[] = [];

    for (const cm of childMarkers) {
      if (cm.linkedMapId != null) {
        const childMap = mapById.get(cm.linkedMapId);
        if (childMap) {
          children.push(buildNode(childMap, level + 1, nextPath, cm));
        }
      }
    }

    const node: MapHierarchyNode = {
      map,
      markerId: marker?.id,
      markerTitle: marker?.title,
      markerKind: marker?.kind,
      children,
      level,
    };
    allNodes.push(node);
    return node;
  }

  // Peta akar = peta yang tidak ditautkan oleh penanda mana pun sebagai linkedMapId
  const rootMaps = maps.filter((m) => m.id != null && !childToParentMarker.has(m.id));

  const roots: MapHierarchyNode[] = [];
  for (const rm of rootMaps) {
    roots.push(buildNode(rm, 0, new Set()));
  }

  // Jika ada peta yang belum terjelajahi (mis. siklus terisolasi tanpa akar murni)
  for (const m of maps) {
    if (m.id != null && !visitedGlobally.has(m.id)) {
      // Jika memiliki tautan keluar atau tautan masuk, jelajahi untuk menemukan siklus
      if (parentToChildMarkers.has(m.id) || childToParentMarker.has(m.id)) {
        roots.push(buildNode(m, 0, new Set()));
      }
    }
  }

  return { roots, allNodes, cycleDetected };
}

/**
 * Ringkasan data sub-peta untuk Sub-Map Preview Card.
 */
export function getSubMapSummary(
  subMapId: number,
  maps: AtlasMap[],
  allMarkers: MapMarker[],
): SubMapSummary | null {
  const targetMap = maps.find((m) => m.id === subMapId);
  if (!targetMap) return null;

  const markersInSubMap = allMarkers.filter((m) => m.mapId === subMapId);
  let pinCount = 0;
  let areaCount = 0;
  let routeCount = 0;
  let childMapCount = 0;

  for (const m of markersInSubMap) {
    if (m.kind === 'pin') pinCount++;
    else if (m.kind === 'area') areaCount++;
    else if (m.kind === 'route') routeCount++;

    if (m.linkedMapId != null) childMapCount++;
  }

  return {
    map: targetMap,
    markerCount: markersInSubMap.length,
    pinCount,
    areaCount,
    routeCount,
    childMapCount,
  };
}
