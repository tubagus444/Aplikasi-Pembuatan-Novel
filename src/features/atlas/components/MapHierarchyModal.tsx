/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal Pohon Hierarki Peta Dunia (World Map Tree & Directory).
 * Menampilkan struktur peta bertingkat seluruh proyek, penanda penghubung,
 * jumlah penanda, dan navigasi langsung sekali klik.
 */

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Map as MapIcon,
  MapPin,
  Hexagon,
  Route as RouteIcon,
  ExternalLink,
  GitFork,
  AlertCircle,
} from 'lucide-react';
import { AtlasMap, MapMarker } from '@/src/types';
import { buildMapHierarchy, MapHierarchyNode } from '@/src/lib/atlasHierarchy';
import { cn } from '@/src/lib/utils';

interface MapHierarchyModalProps {
  maps: AtlasMap[];
  allMarkers: MapMarker[];
  activeMapId?: number;
  onSelectMap: (mapId: number, fromMarkerId?: number) => void;
  onClose: () => void;
}

export function MapHierarchyModal({
  maps,
  allMarkers,
  activeMapId,
  onSelectMap,
  onClose,
}: MapHierarchyModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMapIds, setExpandedMapIds] = useState<Set<number>>(
    () => new Set(maps.map((m) => m.id!).filter(Boolean)),
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { roots, cycleDetected } = useMemo(() => {
    return buildMapHierarchy(maps, allMarkers);
  }, [maps, allMarkers]);

  // Hitung jumlah penanda per peta
  const markerCountByMap = useMemo(() => {
    const counts = new Map<number, { pin: number; area: number; route: number; total: number }>();
    for (const m of allMarkers) {
      if (m.mapId == null) continue;
      const cur = counts.get(m.mapId) ?? { pin: 0, area: 0, route: 0, total: 0 };
      if (m.kind === 'pin') cur.pin++;
      else if (m.kind === 'area') cur.area++;
      else if (m.kind === 'route') cur.route++;
      cur.total++;
      counts.set(m.mapId, cur);
    }
    return counts;
  }, [allMarkers]);

  const toggleExpand = (mapId: number) => {
    setExpandedMapIds((prev) => {
      const next = new Set(prev);
      if (next.has(mapId)) next.delete(mapId);
      else next.add(mapId);
      return next;
    });
  };

  const filteredMaps = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return maps.filter((m) => m.name.toLowerCase().includes(q));
  }, [maps, searchQuery]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <GitFork size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Pohon Hierarki Peta
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Struktur sub-peta bertingkat dan keterkaitan wilayah dalam proyek
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pencarian & Info */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama peta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>

          {cycleDetected && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle size={14} className="shrink-0 text-amber-600" />
              <span>
                Peringatan: Terdeteksi tautan siklis (peta saling menautkan satu sama lain secara melingkar).
              </span>
            </div>
          )}
        </div>

        {/* Daftar Hierarki */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredMaps ? (
            /* Mode hasil pencarian flat */
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 px-1">
                Hasil Pencarian ({filteredMaps.length}):
              </p>
              {filteredMaps.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">
                  Tidak ada peta yang cocok dengan "{searchQuery}".
                </p>
              ) : (
                filteredMaps.map((m) => {
                  const counts = markerCountByMap.get(m.id!) ?? { pin: 0, area: 0, route: 0, total: 0 };
                  const isActive = m.id === activeMapId;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all',
                        isActive
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MapIcon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {m.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {counts.total} penanda ({counts.pin} pin, {counts.area} area, {counts.route} rute)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onSelectMap(m.id!);
                          onClose();
                        }}
                        disabled={isActive}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors',
                          isActive
                            ? 'opacity-40 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs',
                        )}
                      >
                        <ExternalLink size={12} /> Buka
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Mode pohon hierarki */
            <div className="space-y-3">
              {roots.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">
                  Belum ada peta dalam proyek ini.
                </p>
              ) : (
                roots.map((rootNode) => (
                  <TreeNodeItem
                    key={rootNode.map.id}
                    node={rootNode}
                    activeMapId={activeMapId}
                    expandedMapIds={expandedMapIds}
                    markerCountByMap={markerCountByMap}
                    onToggleExpand={toggleExpand}
                    onSelectMap={(mapId, fromMarkerId) => {
                      onSelectMap(mapId, fromMarkerId);
                      onClose();
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Total: {maps.length} peta terdaftar</span>
          <span>Tip: Tautkan penanda ke sub-peta untuk memperdalam dunia ceritamu</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TreeNodeItem({
  node,
  activeMapId,
  expandedMapIds,
  markerCountByMap,
  onToggleExpand,
  onSelectMap,
}: {
  node: MapHierarchyNode;
  activeMapId?: number;
  expandedMapIds: Set<number>;
  markerCountByMap: Map<number, { pin: number; area: number; route: number; total: number }>;
  onToggleExpand: (id: number) => void;
  onSelectMap: (mapId: number, fromMarkerId?: number) => void;
}) {
  const mapId = node.map.id!;
  const isExpanded = expandedMapIds.has(mapId);
  const hasChildren = node.children.length > 0;
  const isActive = mapId === activeMapId;
  const counts = markerCountByMap.get(mapId) ?? { pin: 0, area: 0, route: 0, total: 0 };

  const MarkerIcon = node.markerKind === 'area' ? Hexagon : node.markerKind === 'route' ? RouteIcon : MapPin;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex items-center justify-between p-2.5 rounded-xl border transition-all',
          isActive
            ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-xs'
            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => onToggleExpand(mapId)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <span
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
              node.level === 0
                ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
            )}
          >
            {node.level === 0 ? <MapIcon size={14} /> : <Layers size={14} />}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {node.map.name}
              </span>
              {node.level === 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                  Peta Induk
                </span>
              )}
              {isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
                  Aktif
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
              <span>{counts.total} penanda</span>
              {hasChildren && <span>· {node.children.length} sub-peta</span>}
              {node.markerTitle && (
                <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400 font-medium">
                  · Pintu masuk: <MarkerIcon size={11} /> {node.markerTitle}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onSelectMap(mapId, node.markerId)}
          disabled={isActive}
          className={cn(
            'px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0',
            isActive
              ? 'opacity-40 cursor-default'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs',
          )}
        >
          <ExternalLink size={12} /> Buka
        </button>
      </div>

      {/* Anak sub-peta (indentasi) */}
      {hasChildren && isExpanded && (
        <div className="pl-6 ml-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1 pt-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.map.id}
              node={child}
              activeMapId={activeMapId}
              expandedMapIds={expandedMapIds}
              markerCountByMap={markerCountByMap}
              onToggleExpand={onToggleExpand}
              onSelectMap={onSelectMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
