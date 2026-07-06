/**
 * Papan Faksi (#15 fase 2) — kanvas drag-and-drop React Flow.
 *
 * Prinsip "logika murni = sumber kebenaran, React Flow = cermin": node/edge dirakit dari
 * `buildFactionBoard` (murni, teruji) di `useFactions`. React Flow HANYA lapisan render/
 * interaksi. Posisi kartu = kebenaran DB (`CodexEntry.factionBoard`); selama sesi React
 * Flow memegang posisi transien, di-commit balik ke DB saat drag selesai (`onNodeDragStop`).
 *
 * Di-`React.lazy` dari FactionsPanel → bundle React Flow + CSS hanya dimuat saat kanvas
 * dibuka (mode "Kanvas"), tak membebani load awal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, applyNodeChanges, ConnectionMode,
  type Node, type Edge, type NodeChange, type NodeTypes, type EdgeTypes, type ColorMode, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Layers, Eye, EyeOff } from 'lucide-react';
import type { CategoryDef } from '@/src/lib/codexCategories';
import { getCategoryDef } from '@/src/lib/codexCategories';
import { styleOf } from '@/src/features/lore/relationshipStyles';
import { RELATIONSHIP_TYPES, getRelationshipLabel } from '@/src/features/codex/relationshipTypes';
import type { CodexEntry } from '@/src/types';
import { pairKey, type FactionBoardView, type FactionRelationData } from '@/src/lib/factions';
import { FactionCardNode, type FactionNodeData } from './FactionCardNode';
import { FloatingEdge, type FactionEdgeData } from './FloatingEdge';
import { FactionInspector, type InspectorData } from './FactionInspector';
import { cn } from '@/src/lib/utils';

/** Hex per kunci warna kategori (registry hanya simpan kelas Tailwind) — pola LoreGraphPanel. */
const CATEGORY_HEX: Record<string, string> = {
  indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e',
  sky: '#0ea5e9', slate: '#64748b', violet: '#8b5cf6', teal: '#14b8a6',
  orange: '#f97316', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  pink: '#ec4899', cyan: '#06b6d4', lime: '#84cc16', fuchsia: '#d946ef',
};
const FALLBACK_HEX = '#64748b';

// nodeTypes/edgeTypes WAJIB stabil (referensi modul) — kalau tidak React Flow memperingatkan
// & me-remount tiap render.
const nodeTypes: NodeTypes = { faction: FactionCardNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge };

const cohesionLevel = (cohesion: Record<string, number>): number => {
  const total = Object.values(cohesion).reduce((s, n) => s + n, 0);
  if (total === 0) return 0;
  if (total <= 2) return 1;
  if (total <= 5) return 2;
  return 3;
};

interface Props {
  boardView: FactionBoardView;
  relData: FactionRelationData;
  entryById: Map<number, CodexEntry>;
  categories: CategoryDef[];
  colorMode: ColorMode;
  onOpenEntry: (id: number) => void;
  onPersistPosition: (factionId: number, pos: { x: number; y: number }) => void;
  onAddRelation: (sourceFactionId: number, targetFactionId: number, type: string, note: string) => void;
  onDeleteRelation: (id: number) => void;
}

function FactionBoardInner({ boardView, relData, entryById, categories, colorMode, onOpenEntry, onPersistPosition, onAddRelation, onDeleteRelation }: Props) {
  const [rfNodes, setRfNodes] = useNodesState<Node>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [focusId, setFocusId] = useState<number | null>(null);
  const [showDerived, setShowDerived] = useState(true);
  const [pendingConnect, setPendingConnect] = useState<{ source: number; target: number } | null>(null);
  const draggingRef = useRef(false);

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Ketetanggaan (untuk sorot ego-network) dari edge yang benar-benar tampak.
  const adjacency = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const e of boardView.edges) {
      if (e.kind === 'derived' && !showDerived) continue;
      const a = Number(e.source), b = Number(e.target);
      if (!m.has(a)) m.set(a, new Set());
      if (!m.has(b)) m.set(b, new Set());
      m.get(a)!.add(b); m.get(b)!.add(a);
    }
    return m;
  }, [boardView.edges, showDerived]);

  // Bangun data node dari boardView + state UI (murni). Dipakai reconcile effect.
  const buildData = useCallback((n: FactionBoardView['nodes'][number]): FactionNodeData => {
    const entry = entryById.get(n.factionId);
    const category = entry?.category ?? 'other';
    const colorKey = getCategoryDef(category, categories)?.color ?? 'slate';
    const neighbors = focusId != null ? adjacency.get(focusId) : undefined;
    const focused = focusId === n.factionId;
    const neighbor = !!neighbors?.has(n.factionId);
    return {
      factionId: n.factionId,
      name: n.name,
      hidden: n.hidden,
      category,
      accent: CATEGORY_HEX[colorKey] ?? FALLBACK_HEX,
      members: n.memberIds
        .map(id => entryById.get(id))
        .filter((e): e is CodexEntry => !!e)
        .map(e => ({ id: e.id!, name: e.name, category: e.category })),
      cohesionLevel: cohesionLevel(n.cohesion),
      collapsed: collapsed.has(n.factionId),
      dimmed: focusId != null && !focused && !neighbor,
      focused,
      neighbor,
      categories,
      onOpenEntry,
      onToggleCollapse: toggleCollapse,
    };
  }, [entryById, categories, focusId, adjacency, collapsed, onOpenEntry, toggleCollapse]);

  // Reconcile: rebuild node list saat data/UI berubah. Posisi = kebenaran sesi React Flow
  // (dipertahankan dari node yang sudah ada); node baru di-seed dari boardView.position (DB).
  // Effect ini TAK jalan saat drag (deps stabil) → drag mulus, tanpa lompatan.
  useEffect(() => {
    setRfNodes(prev => {
      const prevById = new Map(prev.map(p => [p.id, p]));
      return boardView.nodes.map(n => {
        const existing = prevById.get(n.id);
        return {
          id: n.id,
          type: 'faction',
          position: existing ? existing.position : n.position,
          data: buildData(n),
          selected: existing?.selected,
        } as Node;
      });
    });
  }, [boardView.nodes, buildData, setRfNodes]);

  // Edge dari boardView (floating). Warna per-tipe (styleOf.hex), declared solid / derived dashed.
  const rfEdges = useMemo<Edge[]>(() => {
    return boardView.edges
      .filter(e => showDerived || e.kind === 'declared')
      .map(e => {
        const a = Number(e.source), b = Number(e.target);
        const dimmed = focusId != null && a !== focusId && b !== focusId;
        const emphasis = focusId != null && (a === focusId || b === focusId);
        const data: FactionEdgeData = {
          color: styleOf(e.type).hex,
          kind: e.kind,
          label: getRelationshipLabel(e.type, true),
          dimmed,
          emphasis,
        };
        return { id: e.id, source: e.source, target: e.target, type: 'floating', data, zIndex: emphasis ? 2 : 1 };
      });
  }, [boardView.edges, showDerived, focusId]);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    for (const c of changes) {
      if (c.type === 'position' && c.dragging) draggingRef.current = true;
    }
    setRfNodes(nds => applyNodeChanges(changes, nds));
  }, [setRfNodes]);

  // Klik kartu (bukan drag) → toggle sorot ego-network.
  const onNodeClick = useCallback((_: unknown, node: Node) => {
    if (draggingRef.current) return; // klik palsu di akhir drag
    const id = Number(node.id);
    setFocusId(prev => (prev === id ? null : id));
  }, []);

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    draggingRef.current = false;
    onPersistPosition(Number(node.id), node.position);
  }, [onPersistPosition]);

  // Drag-to-connect: tarik dari handle satu kartu ke kartu lain → dialog pilih tipe.
  const onConnect = useCallback((c: Connection) => {
    const source = Number(c.source), target = Number(c.target);
    if (!source || !target || source === target) return;
    setPendingConnect({ source, target });
  }, []);

  // Data inspector untuk faksi terfokus (klik kartu) — diturunkan dari relData (teruji).
  const inspector = useMemo<InspectorData | null>(() => {
    if (focusId == null) return null;
    const node = boardView.nodes.find(n => n.factionId === focusId);
    if (!node) return null;
    const members = node.memberIds
      .map(id => entryById.get(id))
      .filter((e): e is CodexEntry => !!e)
      .map(e => ({ id: e.id!, name: e.name, category: e.category }));
    const rows: InspectorData['rows'] = [];
    for (const other of boardView.nodes) {
      if (other.factionId === focusId) continue;
      const stat = relData.pairMap.get(pairKey(focusId, other.factionId));
      const declared = stat?.declared ?? [];
      const derived = stat?.derived ?? {};
      if (declared.length > 0 || Object.keys(derived).length > 0) {
        rows.push({ other: { id: other.factionId, name: other.name, hidden: other.hidden }, declared, derived });
      }
    }
    rows.sort((a, b) => a.other.name.localeCompare(b.other.name, 'id'));
    const others = boardView.nodes
      .filter(n => n.factionId !== focusId)
      .map(n => ({ id: n.factionId, name: n.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
    return {
      faction: { id: node.factionId, name: node.name, hidden: node.hidden, tag: node.tag },
      members, rows, others,
      internal: relData.internal.get(focusId) ?? {},
    };
  }, [focusId, boardView.nodes, relData, entryById]);

  const collapseAll = useCallback(() => {
    setCollapsed(prev => (prev.size === boardView.nodes.length ? new Set() : new Set(boardView.nodes.map(n => n.factionId))));
  }, [boardView.nodes]);

  const allCollapsed = collapsed.size === boardView.nodes.length && boardView.nodes.length > 0;
  const focusName = focusId != null ? boardView.nodes.find(n => n.factionId === focusId)?.name : undefined;
  const focusNeighbors = focusId != null ? (adjacency.get(focusId)?.size ?? 0) : 0;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={() => setFocusId(null)}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={1.8}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.data as FactionNodeData | undefined)?.accent ?? FALLBACK_HEX}
          nodeStrokeWidth={2}
          className="!bg-white/70 dark:!bg-slate-900/70"
        />
      </ReactFlow>

      {/* Toolbar melayang (kiri-atas) */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
        <button
          onClick={collapseAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-400 shadow-sm"
          title="Ciutkan / buka semua kartu"
        >
          <Layers size={13} /> {allCollapsed ? 'Buka semua' : 'Ciutkan semua'}
        </button>
        <button
          onClick={() => setShowDerived(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium shadow-sm backdrop-blur',
            showDerived
              ? 'border-indigo-400 bg-indigo-600 text-white'
              : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300',
          )}
          title="Tampilkan garis potret turunan (relasi antar-anggota)"
        >
          {showDerived ? <Eye size={13} /> : <EyeOff size={13} />} Potret turunan
        </button>

        {focusId != null && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-indigo-400 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-xs text-slate-600 dark:text-slate-300 shadow-sm">
            <span>Menyorot <b className="text-slate-800 dark:text-slate-100">{focusName}</b> · {focusNeighbors} relasi</span>
            <button onClick={() => setFocusId(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium">✕ Lepas</button>
          </div>
        )}
      </div>

      {/* Legenda (kanan-atas) — disembunyikan saat inspector terbuka agar tak tertimpa */}
      {!inspector && (
        <div className="absolute top-3 right-3 z-10 rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur px-2.5 py-2 shadow-sm text-[11px]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Garis relasi</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 border-t-2 border-slate-500" /> <span className="text-slate-600 dark:text-slate-300">Dideklarasikan</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 border-t-2 border-dashed border-slate-400" /> <span className="text-slate-600 dark:text-slate-300">Potret turunan</span>
          </div>
        </div>
      )}

      {/* Inspector drawer (klik kartu) */}
      {inspector && (
        <FactionInspector
          data={inspector}
          categories={categories}
          onOpenEntry={onOpenEntry}
          onAddRelation={(otherId, type, note) => onAddRelation(inspector.faction.id, otherId, type, note)}
          onDeleteRelation={onDeleteRelation}
          onClose={() => setFocusId(null)}
        />
      )}

      {/* Dialog drag-to-connect */}
      {pendingConnect && (
        <ConnectDialog
          sourceName={boardView.nodes.find(n => n.factionId === pendingConnect.source)?.name ?? '?'}
          targetName={boardView.nodes.find(n => n.factionId === pendingConnect.target)?.name ?? '?'}
          onCancel={() => setPendingConnect(null)}
          onConfirm={(type, note) => {
            onAddRelation(pendingConnect.source, pendingConnect.target, type, note);
            setPendingConnect(null);
          }}
        />
      )}
    </div>
  );
}

/** Dialog kecil terpusat untuk drag-to-connect: pilih tipe relasi + catatan. */
function ConnectDialog({ sourceName, targetName, onCancel, onConfirm }: {
  sourceName: string; targetName: string;
  onCancel: () => void; onConfirm: (type: string, note: string) => void;
}) {
  const [type, setType] = useState('Ally');
  const [note, setNote] = useState('');
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-slate-900/20 backdrop-blur-[1px]" onClick={onCancel}>
      <div className="w-[280px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
          {sourceName} <span className="text-slate-400">→</span> {targetName}
        </div>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Tipe relasi</label>
        <select value={type} onChange={e => setType(e.target.value)}
          className="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 mb-3">
          {RELATIONSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Catatan (opsional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="kenapa?"
          className="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 mb-4" />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Batal</button>
          <button onClick={() => onConfirm(type, note)} className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium">Simpan</button>
        </div>
      </div>
    </div>
  );
}

export default function FactionBoardCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FactionBoardInner {...props} />
    </ReactFlowProvider>
  );
}
