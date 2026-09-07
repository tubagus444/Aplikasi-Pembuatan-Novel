/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kartu Pratinjau Sub-Peta (Sub-Map Preview Card) di MarkerSidebar.
 * Menampilkan thumbnail peta anak, statistik penanda di dalamnya,
 * resolusi/skala, dan tombol langsung untuk menjelajahinya.
 */

import { useState, useEffect } from 'react';
import {
  Layers,
  ExternalLink,
  MapPin,
  Hexagon,
  Route as RouteIcon,
  Ruler,
  Image as ImageIcon,
  Edit2,
  Unlink,
} from 'lucide-react';
import { AtlasMap, MapMarker } from '@/src/types';
import { getSubMapSummary } from '@/src/lib/atlasHierarchy';

interface SubMapPreviewCardProps {
  subMapId?: number;
  activeMapId: number;
  allMaps: AtlasMap[];
  allMarkers?: MapMarker[];
  onOpenSubMap?: (mapId: number) => void;
  onChangeLinkedMap: (newMapId?: number) => void;
}

export function SubMapPreviewCard({
  subMapId,
  activeMapId,
  allMaps,
  allMarkers = [],
  onOpenSubMap,
  onChangeLinkedMap,
}: SubMapPreviewCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const subMap = subMapId ? allMaps.find((m) => m.id === subMapId) : undefined;
  const summary = subMapId ? getSubMapSummary(subMapId, allMaps, allMarkers) : null;

  // Hasilkan & bersihkan URL blob thumbnail
  useEffect(() => {
    if (subMap?.imageBlob) {
      const url = URL.createObjectURL(subMap.imageBlob);
      setThumbnailUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setThumbnailUrl(null);
    }
  }, [subMap?.imageBlob]);

  // Daftar peta yang tersedia untuk ditautkan (kecuali peta aktif itu sendiri)
  const availableMaps = allMaps.filter((m) => m.id !== activeMapId);

  if (!subMap || isChanging) {
    return (
      <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <label className="block space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-500" /> Tautkan ke Sub-Peta
            </span>
            {subMap && (
              <button
                type="button"
                onClick={() => setIsChanging(false)}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Batal
              </button>
            )}
          </div>
          <select
            value={subMapId ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onChangeLinkedMap(val);
              setIsChanging(false);
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-400 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
          >
            <option value="">— Tidak ada sub-peta —</option>
            {availableMaps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Jadikan penanda ini pintu gerbang menuju peta yang lebih mendalam (mis. peta kota, denah kastil, atau dungeon).
        </p>
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-gradient-to-b from-indigo-50/50 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900/60 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 space-y-3 shadow-xs">
      {/* Header Kartu */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <Layers size={13} /> Gerbang Sub-Peta
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsChanging(true)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Ganti sub-peta"
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => onChangeLinkedMap(undefined)}
            className="p-1 rounded text-slate-400 hover:text-rose-500"
            title="Lepas tautan sub-peta"
          >
            <Unlink size={12} />
          </button>
        </div>
      </div>

      {/* Gambar Thumbnail & Nama Peta */}
      <div className="flex gap-3">
        <div className="w-20 h-16 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center relative group">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={subMap.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <ImageIcon size={20} className="text-slate-400" />
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {subMap.name}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {subMap.width} × {subMap.height} px
          </p>
          {subMap.scale && (
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
              <Ruler size={10} /> Skala aktif
            </p>
          )}
        </div>
      </div>

      {/* Ringkasan Penanda di Sub-Peta */}
      {summary && (
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-center">
          <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
              <MapPin size={10} /> Pin
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {summary.pinCount}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
              <Hexagon size={10} /> Area
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {summary.areaCount}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
              <RouteIcon size={10} /> Rute
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {summary.routeCount}
            </span>
          </div>
        </div>
      )}

      {/* Tombol Aksi Utama Masuk ke Sub-Peta */}
      {onOpenSubMap && (
        <button
          type="button"
          onClick={() => onOpenSubMap(subMap.id!)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-500/20 active:scale-[0.99] transition-all cursor-pointer"
        >
          <ExternalLink size={13} /> Masuk & Jelajahi Sub-Peta ↗
        </button>
      )}
    </div>
  );
}
