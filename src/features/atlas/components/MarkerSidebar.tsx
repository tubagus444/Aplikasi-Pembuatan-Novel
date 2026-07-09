/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Panel samping detail penanda Atlas — deskripsi Codex tertaut + kehadiran bab
 * (dari `PresenceIndex`, reuse), taut/lepas Codex, sunting judul/catatan/warna,
 * dan hapus. Klik "Buka di Codex" → `openCodexEntry` (deep-link dua-arah §4).
 */

import { useEffect, useState } from 'react';
import { MapPin, Route as RouteIcon, Hexagon, X, Trash2, BookOpen, Link2, Move, Check, Clock, Ruler } from 'lucide-react';
import { CodexEntry, MapMarker, AtlasMap, TravelSpeedProfile, MapPoint } from '@/src/types';
import { CategoryDef, getCategoryLabel } from '@/src/lib/codexCategories';
import { stripHtml } from '@/src/lib/editorUtils';
import { cn } from '@/src/lib/utils';
import { RegionAnalytic } from '@/src/lib/atlasAnalytics';
import { calculateRelativeDistance, calculateRealDistance, calculateTravelTime } from '@/src/lib/mapGeometry';

export interface PresenceChapter {
  id: number;
  title: string;
  /** Nomor tampil (1-based, urutan manuskrip). */
  number: number;
}

interface MarkerSidebarProps {
  marker: MapMarker;
  entry?: CodexEntry;
  categories: CategoryDef[];
  presence: PresenceChapter[];
  regionAnalytic?: RegionAnalytic;
  color: string;
  /** Entri Codex untuk dropdown taut. */
  codexEntries: CodexEntry[];
  /** Mode ubah geometri (seret handle di peta) aktif untuk penanda ini. */
  editing: boolean;
  activeMap: AtlasMap;
  travelSpeeds?: TravelSpeedProfile[];
  onToggleEdit: () => void;
  onSave: (patch: Partial<MapMarker>) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenCodex: (id: number) => void;
  onJumpChapter: (id: number) => void;
}

const KIND_META: Record<string, { icon: typeof MapPin; label: string }> = {
  pin: { icon: MapPin, label: 'Pin lokasi' },
  area: { icon: Hexagon, label: 'Wilayah' },
  route: { icon: RouteIcon, label: 'Rute' },
};

export default function MarkerSidebar({
  marker,
  entry,
  categories,
  presence,
  regionAnalytic,
  color,
  codexEntries,
  editing,
  activeMap,
  travelSpeeds,
  onToggleEdit,
  onSave,
  onDelete,
  onClose,
  onOpenCodex,
  onJumpChapter,
}: MarkerSidebarProps) {
  const [title, setTitle] = useState(marker.title ?? '');
  const [note, setNote] = useState(marker.note ?? '');

  // Reset field lokal saat penanda yang dipilih berganti.
  useEffect(() => {
    setTitle(marker.title ?? '');
    setNote(marker.note ?? '');
  }, [marker.id]);

  const Meta = KIND_META[marker.kind] ?? KIND_META.pin;
  const Icon = Meta.icon;
  const heading = entry?.name || marker.title || Meta.label;
  const description = entry?.description ? stripHtml(entry.description) : '';

  // Hitung jarak & waktu untuk Rute
  const isRoute = marker.kind === 'route' && Array.isArray(marker.geometry);
  const relDist = isRoute ? calculateRelativeDistance(marker.geometry as MapPoint[]) : 0;
  const realDist = isRoute && activeMap.scale ? calculateRealDistance(relDist, activeMap.scale) : 0;
  const hasScale = !!activeMap.scale;
  
  const selectedSpeedId = marker.meta?.speedProfileId;
  const selectedSpeed = travelSpeeds?.find(s => s.id === selectedSpeedId);
  const travelTime = realDist > 0 && selectedSpeed ? calculateTravelTime(realDist, selectedSpeed.speedPerDay) : 0;

  return (
    <aside className="w-80 shrink-0 h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="flex items-start justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
            <Icon size={14} className="text-white" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{heading}</h3>
            <p className="text-[11px] text-slate-400">{Meta.label}{entry && ` · ${getCategoryLabel(entry.category, categories)}`}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Ubah geometri */}
        <div className="space-y-2">
          <button
            onClick={onToggleEdit}
            className={cn('w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border',
              editing
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300')}
          >
            {editing ? <><Check size={14} /> Selesai mengubah</> : <><Move size={14} /> Ubah posisi/bentuk</>}
          </button>
          {editing && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
              {marker.kind === 'pin'
                ? 'Seret titik di peta untuk memindahkan pin.'
                : 'Seret titik untuk memindah · klik titik-tengah untuk menambah · klik-kanan titik untuk menghapus.'}
            </p>
          )}
        </div>

        {/* Deskripsi Codex */}
        {entry ? (
          <div className="space-y-2">
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-6">{description}</p>
            )}
            <button
              onClick={() => onOpenCodex(entry.id!)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <BookOpen size={13} /> Buka di Codex
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Penanda ini belum tertaut entri Codex.</p>
        )}

        {/* Taut Codex */}
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Link2 size={12} /> Taut Codex</span>
          <select
            value={marker.codexId ?? ''}
            onChange={(e) => onSave({ codexId: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">— tak tertaut —</option>
            {codexEntries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        
        {/* Kalkulator Waktu & Jarak (hanya untuk Rute) */}
        {marker.kind === 'route' && (
          <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Ruler size={12} /> Jarak Rute</span>
              {hasScale ? (
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {realDist.toLocaleString(undefined, { maximumFractionDigits: 1 })} {activeMap.scale!.distanceUnit}
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 dark:text-amber-500 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">Belum dikalibrasi</span>
              )}
            </div>
            
            {hasScale && (
              <>
                <label className="block space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Metode Perjalanan</span>
                  <select
                    value={selectedSpeedId ?? ''}
                    onChange={(e) => onSave({ meta: { ...marker.meta, speedProfileId: e.target.value || undefined } })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">— pilih metode —</option>
                    {(travelSpeeds || []).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.speedPerDay} {activeMap.scale!.distanceUnit}/{s.unit})</option>
                    ))}
                  </select>
                </label>
                
                {selectedSpeed && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Clock size={12} /> Estimasi Waktu</span>
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {Math.ceil(travelTime)} {selectedSpeed.unit}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Kehadiran bab */}
        {(entry || regionAnalytic) && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {marker.kind === 'area' ? 'Aktivitas di Wilayah Ini' : 'Muncul di bab'}
            </span>
            {regionAnalytic && regionAnalytic.containedPins.length > 0 && (
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                Menyatukan aktivitas dari area ini dan <span className="font-semibold text-slate-700 dark:text-slate-300">{regionAnalytic.containedPins.length} penanda</span> di dalamnya.
              </p>
            )}
            {presence.length ? (
              <div className="flex flex-wrap gap-1.5">
                {presence.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => onJumpChapter(ch.id)}
                    title={ch.title}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                  >
                    {ch.number}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-500">Belum pernah muncul dalam manuskrip.</p>
            )}
          </div>
        )}

        {/* Judul & catatan fallback */}
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Judul {entry && '(fallback)'}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== (marker.title ?? '') && onSave({ title: title.trim() || undefined })}
            placeholder="mis. Gerbang Utara"
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Catatan</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (marker.note ?? '') && onSave({ note: note.trim() || undefined })}
            rows={3}
            placeholder="Catatan bebas untuk penanda ini…"
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400"
          />
        </label>

        {/* Warna override */}
        <label className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Warna</span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={marker.color ?? color}
              onChange={(e) => onSave({ color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent"
              aria-label="Warna penanda"
            />
            {marker.color && (
              <button onClick={() => onSave({ color: undefined })} className="text-[11px] text-slate-400 hover:text-slate-600">reset</button>
            )}
          </span>
        </label>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onDelete}
          className={cn('w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
            'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40')}
        >
          <Trash2 size={14} /> Hapus penanda
        </button>
      </div>
    </aside>
  );
}
