/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Atlas Dunia (`viewMode 'atlas'`) — panel peta interaktif. Penulis meng-upload
 * gambar peta, menandai pin/area/rute, menaut ke Codex, lalu memfilter per
 * jenis/kategori/faksi. Analitik nol-token: kehadiran bab dari `PresenceIndex`.
 *
 * Orchestrator saja — render peta di `MapCanvas` (Leaflet), detail di
 * `MarkerSidebar`, geometri murni di `src/lib/mapGeometry.ts`, warna di
 * `src/lib/atlasColors.ts`. Data tetap PENUH; filter hanya state komponen
 * (pola LoreGraphPanel).
 */

import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { Map as MapIcon, MapPin, Hexagon, Route as RouteIcon, Plus, Trash2, SlidersHorizontal, Upload, Loader2 } from 'lucide-react';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useProjectData } from '@/src/hooks/useProjectData';
import { useCodexCategories } from '@/src/features/codex/hooks/useCodexCategories';
import { getCategoryLabel } from '@/src/lib/codexCategories';
import { stripHtml } from '@/src/lib/editorUtils';
import { usePresenceIndex } from '@/src/hooks/usePresenceIndex';
import { resolveMarkerColor } from '@/src/lib/atlasColors';
import { cn } from '@/src/lib/utils';
import { CodexEntry, MapMarker, MapPoint } from '@/src/types';
import { analyzeRegions, RegionAnalytic } from '@/src/lib/atlasAnalytics';
import { useAtlas } from '../hooks/useAtlas';
import { useMapImageUpload } from '../hooks/useMapImageUpload';
import type { DrawMode } from './MapCanvas';
import type { PresenceChapter } from './MarkerSidebar';

const MapCanvas = lazy(() => import('./MapCanvas'));
const MarkerSidebar = lazy(() => import('./MarkerSidebar'));

const KIND_BTN: { kind: 'pin' | 'area' | 'route'; icon: typeof MapPin; label: string }[] = [
  { kind: 'pin', icon: MapPin, label: 'Pin' },
  { kind: 'area', icon: Hexagon, label: 'Area' },
  { kind: 'route', icon: RouteIcon, label: 'Rute' },
];

interface AtlasPanelProps {
  projectId: number;
}

export function AtlasPanel({ projectId }: AtlasPanelProps) {
  const { setActiveChapterId, setViewMode, openCodexEntry } = useNavigation();
  const { codexEntries } = useProjectData(projectId);
  const { categories } = useCodexCategories(projectId);

  const chapters = useLiveQuery(
    () => db.chapters.where('projectId').equals(projectId).sortBy('order'),
    [projectId],
  );

  const [selectedMapId, setSelectedMapId] = useState<number | undefined>(undefined);
  const { maps, markers, mapsLoading, createMap, renameMap, setMapImage, deleteMap, addMarker, updateMarker, deleteMarker } = useAtlas(selectedMapId);
  const { process, processing, error: uploadError } = useMapImageUpload();

  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | undefined>(undefined);
  const [editingGeometry, setEditingGeometry] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reuploadRef = useRef<HTMLInputElement>(null);

  // Filter: set jenis/kategori/faksi yang DIMATIKAN (data tetap penuh).
  const [offKinds, setOffKinds] = useState<Set<string>>(new Set());
  const [offCategories, setOffCategories] = useState<Set<string>>(new Set());
  const [offFactions, setOffFactions] = useState<Set<string>>(new Set());

  // Peta aktif = pilihan eksplisit atau peta pertama.
  const activeMap = useMemo(
    () => maps.find((m) => m.id === selectedMapId) ?? maps[0],
    [maps, selectedMapId],
  );

  // Kunci `selectedMapId` ke peta valid begitu daftar termuat. Tanpa ini, setelah
  // refresh/pindah panel `selectedMapId` = undefined sementara peta tetap tampil lewat
  // fallback `maps[0]` → query penanda (dikunci ke `selectedMapId`) mengembalikan []
  // → pin/area/rute TERSIMPAN tapi tak tampil, & penanda baru seolah gagal disimpan.
  useEffect(() => {
    if (maps.length && (selectedMapId == null || !maps.some((m) => m.id === selectedMapId))) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps, selectedMapId]);

  // Mode edit hanya berlaku untuk penanda yang sedang dipilih → matikan saat pilihan
  // berganti / hilang (mis. klik penanda lain, tutup sidebar, mulai menggambar).
  useEffect(() => {
    setEditingGeometry(false);
  }, [selectedMarkerId]);

  const entryById = useMemo(() => {
    const m = new Map<number, CodexEntry>();
    for (const e of codexEntries) if (e.id != null) m.set(e.id, e);
    return m;
  }, [codexEntries]);

  const colorFor = useMemo(
    () => (mk: MapMarker) => resolveMarkerColor(mk.kind, mk.color, mk.codexId != null ? entryById.get(mk.codexId) : undefined, categories),
    [entryById, categories],
  );

  // Kategori & faksi yang HADIR di antara penanda peta ini (untuk daftar filter).
  const { presentCategories, presentFactions } = useMemo(() => {
    const cats = new Set<string>();
    const facs = new Set<string>();
    for (const mk of markers) {
      const e = mk.codexId != null ? entryById.get(mk.codexId) : undefined;
      if (!e) continue;
      cats.add(e.category);
      if (e.factionTag && e.factionTag.trim()) facs.add(e.factionTag.trim());
    }
    return { presentCategories: [...cats], presentFactions: [...facs] };
  }, [markers, entryById]);

  const visibleMarkers = useMemo(() => {
    return markers.filter((mk) => {
      if (offKinds.has(mk.kind)) return false;
      const e = mk.codexId != null ? entryById.get(mk.codexId) : undefined;
      if (e) {
        if (offCategories.has(e.category)) return false;
        if (e.factionTag && offFactions.has(e.factionTag.trim())) return false;
      }
      return true;
    });
  }, [markers, offKinds, offCategories, offFactions, entryById]);

  // Teks bab polos di-memo (ref stabil) untuk feed worker.
  const presenceChaptersPlain = useMemo(() => {
    if (!chapters) return null;
    return chapters
      .filter((c) => c.id != null)
      .map((c) => ({ id: c.id!, title: c.title, content: stripHtml(c.content || '') }));
  }, [chapters]);

  // Scan kehadiran (nama+alias) di WORKER agar main thread tak jank pada naskah besar.
  const idx = usePresenceIndex(presenceChaptersPlain, codexEntries);
  const presenceIndex = useMemo(
    () => (presenceChaptersPlain && idx ? { index: idx, chapters: presenceChaptersPlain } : null),
    [presenceChaptersPlain, idx]
  );

  const regionAnalytics = useMemo(() => {
    if (!presenceIndex || !maps.length) return [];
    return analyzeRegions(markers, presenceIndex.index, codexEntries);
  }, [markers, presenceIndex, codexEntries, maps.length]);

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId);
  const selectedEntry = selectedMarker?.codexId != null ? entryById.get(selectedMarker.codexId) : undefined;

  const selectedRegionAnalytic = useMemo(() => {
    return selectedMarker?.kind === 'area' ? regionAnalytics.find(r => r.markerId === selectedMarker.id) : undefined;
  }, [selectedMarker, regionAnalytics]);

  const presenceChapters: PresenceChapter[] = useMemo(() => {
    if (!presenceIndex) return [];
    let indices: number[] = [];
    
    if (selectedRegionAnalytic) {
      indices = selectedRegionAnalytic.associatedChapters;
    } else if (selectedEntry?.id) {
      const rec = presenceIndex.index.byEntity.get(selectedEntry.id);
      if (rec) indices = rec.indices;
    }
    
    return indices.map((i) => ({
      id: presenceIndex.chapters[i].id,
      title: presenceIndex.chapters[i].title,
      number: i + 1,
    }));
  }, [selectedEntry, presenceIndex, selectedRegionAnalytic]);

  // --- Handler ---
  const handleUpload = async (file: File) => {
    const processed = await process(file);
    if (!processed) return;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'Peta';
    const id = await createMap(baseName, processed);
    if (id != null) setSelectedMapId(id);
  };

  const handleReupload = async (file: File) => {
    if (!activeMap?.id) return;
    const processed = await process(file);
    if (processed) await setMapImage(activeMap.id, processed);
  };

  const handleCreateGeometry = async (geometry: MapPoint | MapPoint[]) => {
    if (!activeMap?.id || !drawMode) return;
    const id = await addMarker({ mapId: activeMap.id, kind: drawMode, geometry });
    setDrawMode(null);
    if (id != null) setSelectedMarkerId(id);
  };

  const handleGeometryChange = (markerId: number, geometry: MapPoint | MapPoint[]) => {
    updateMarker(markerId, { geometry });
  };

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  const handleDeleteMap = async () => {
    if (!activeMap?.id) return;
    if (!window.confirm(`Hapus peta "${activeMap.name}" beserta semua penandanya?`)) return;
    await deleteMap(activeMap.id);
    setSelectedMapId(undefined);
    setSelectedMarkerId(undefined);
  };

  // --- Empty state: belum ada peta ---
  if (mapsLoading) {
    return <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  }

  if (maps.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
          <MapIcon size={30} className="text-indigo-500" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-2xl font-serif text-slate-900 dark:text-slate-100">Atlas Dunia</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Unggah gambar peta duniamu, lalu tandai lokasi, wilayah, dan rute yang bisa diklik — tertaut ke Codex & manuskrip. Sepenuhnya lokal, tanpa AI.
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={processing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60"
        >
          {processing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Unggah gambar peta
        </button>
        <p className="text-[11px] text-slate-400">PNG · JPG · WEBP · GIF · maks 5 MB</p>
        {uploadError && <p className="text-xs text-rose-500">{uploadError}</p>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <MapIcon size={16} className="text-indigo-500 shrink-0" />
        {/* Pemilih peta */}
        {maps.length > 1 && (
          <select
            value={activeMap?.id ?? ''}
            onChange={(e) => { setSelectedMapId(Number(e.target.value)); setSelectedMarkerId(undefined); setDrawMode(null); }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm max-w-[10rem]"
          >
            {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        {activeMap && (
          <input
            key={activeMap.id}
            defaultValue={activeMap.name}
            onBlur={(e) => activeMap.id && renameMap(activeMap.id, e.target.value)}
            aria-label="Nama peta"
            className="bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-400 rounded-lg px-2 py-1.5 text-sm font-medium min-w-[6rem] max-w-[12rem] focus:outline-none"
          />
        )}

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Alat gambar */}
        {KIND_BTN.map(({ kind, icon: Icon, label }) => (
          <button
            key={kind}
            onClick={() => { setDrawMode(drawMode === kind ? null : kind); setSelectedMarkerId(undefined); }}
            className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border',
              drawMode === kind
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300')}
          >
            <Icon size={14} /> {label}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          onClick={() => setShowFilters((s) => !s)}
          className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border',
            showFilters ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}
        >
          <SlidersHorizontal size={14} /> Filter
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => fileRef.current?.click()} disabled={processing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 disabled:opacity-60">
            {processing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Peta
          </button>
          <button onClick={handleDeleteMap} aria-label="Hapus peta"
            className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
            <Trash2 size={14} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      </div>

      {/* Hint gambar + error */}
      {(drawMode || uploadError) && (
        <div className="shrink-0 px-3 py-1.5 text-xs border-b border-slate-100 dark:border-slate-800 bg-indigo-50/60 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
          {uploadError ? <span className="text-rose-600 dark:text-rose-400">{uploadError}</span> : drawMode === 'pin'
            ? 'Klik di peta untuk menaruh pin.'
            : `Klik menambah titik · dobel-klik atau Enter untuk selesai · Esc batal${draftCount ? ` (${draftCount} titik)` : ''}.`}
        </div>
      )}

      {/* Panel filter */}
      {showFilters && (
        <div className="shrink-0 flex flex-wrap gap-4 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs">
          <FilterGroup title="Jenis">
            {KIND_BTN.map(({ kind, label }) => (
              <FilterChip key={kind} active={!offKinds.has(kind)} onClick={() => toggle(offKinds, setOffKinds, kind)}>{label}</FilterChip>
            ))}
          </FilterGroup>
          {presentCategories.length > 0 && (
            <FilterGroup title="Kategori">
              {presentCategories.map((c) => (
                <FilterChip key={c} active={!offCategories.has(c)} onClick={() => toggle(offCategories, setOffCategories, c)}>{getCategoryLabel(c, categories)}</FilterChip>
              ))}
            </FilterGroup>
          )}
          {presentFactions.length > 0 && (
            <FilterGroup title="Faksi">
              {presentFactions.map((f) => (
                <FilterChip key={f} active={!offFactions.has(f)} onClick={() => toggle(offFactions, setOffFactions, f)}>{f}</FilterChip>
              ))}
            </FilterGroup>
          )}
        </div>
      )}

      {/* Peta + sidebar */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          {activeMap && !activeMap.imageBlob && (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                Gambar peta ini tidak tersimpan dalam cadangan otomatis (untuk menghemat ruang). Penanda tetap utuh — unggah ulang gambarnya untuk menampilkannya kembali.
              </p>
              <button
                onClick={() => reuploadRef.current?.click()}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {processing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Unggah ulang gambar
              </button>
              <input ref={reuploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReupload(f); e.target.value = ''; }} />
            </div>
          )}
          {activeMap && activeMap.imageBlob && (
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}>
              <MapCanvas
                key={activeMap.id}
                map={activeMap}
                markers={visibleMarkers}
                drawMode={drawMode}
                selectedMarkerId={selectedMarkerId}
                editing={editingGeometry}
                colorFor={colorFor}
                onCreateGeometry={handleCreateGeometry}
                onMarkerClick={(m) => { setSelectedMarkerId(m.id); setDrawMode(null); }}
                onGeometryChange={handleGeometryChange}
                onDraftChange={setDraftCount}
              />
            </Suspense>
          )}
        </div>
        {selectedMarker && (
          <Suspense fallback={null}>
            <MarkerSidebar
              marker={selectedMarker}
              entry={selectedEntry}
              categories={categories}
              presence={presenceChapters}
              regionAnalytic={selectedRegionAnalytic}
              color={colorFor(selectedMarker)}
              codexEntries={codexEntries}
              editing={editingGeometry}
              onToggleEdit={() => { setDrawMode(null); setEditingGeometry((v) => !v); }}
              onSave={(patch) => selectedMarker.id && updateMarker(selectedMarker.id, patch)}
              onDelete={() => { if (selectedMarker.id) { deleteMarker(selectedMarker.id); setSelectedMarkerId(undefined); } }}
              onClose={() => setSelectedMarkerId(undefined)}
              onOpenCodex={openCodexEntry}
              onJumpChapter={(id) => { setActiveChapterId(id); setViewMode('write'); }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-bold uppercase tracking-wider text-slate-400">{title}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('px-2 py-0.5 rounded-md border',
        active
          ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
          : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 line-through')}
    >
      {children}
    </button>
  );
}
