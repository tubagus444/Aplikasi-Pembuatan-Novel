import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import type { CodexEntry } from '@/src/types';
import { useCodexCategories } from '@/src/features/codex/hooks/useCodexCategories';
import {
  buildFactions, aggregateFactionRelations, factionPairSentiment, pairKey,
  type Faction, type FactionPairStat, type FactionSentiment,
} from '@/src/lib/factions';

export interface FactionRelationRow {
  faction: Faction;
  stat: FactionPairStat | undefined;
  sentiment: FactionSentiment;
}

export function useFactions(projectId: number) {
  const allEntries = useLiveQuery(
    () => db.codex.where('projectId').equals(projectId).toArray(),
    [projectId],
  );
  const relationships = useLiveQuery(
    () => db.relationships.where('projectId').equals(projectId).toArray(),
    [projectId],
  );
  const { categories } = useCodexCategories(projectId);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const factions = useMemo(() => buildFactions(allEntries ?? []), [allEntries]);
  const relData = useMemo(
    () => aggregateFactionRelations(factions, relationships ?? []),
    [factions, relationships],
  );

  // Auto-pilih faksi pertama.
  useEffect(() => {
    if (factions.length > 0 && (selectedId === null || !factions.some(f => f.id === selectedId))) {
      setSelectedId(factions[0].id);
    } else if (factions.length === 0 && selectedId !== null) {
      setSelectedId(null);
    }
  }, [factions, selectedId]);

  const selected = useMemo(() => factions.find(f => f.id === selectedId) ?? null, [factions, selectedId]);

  const entryById = useMemo(() => {
    const m = new Map<number, CodexEntry>();
    (allEntries ?? []).forEach(e => e.id != null && m.set(e.id, e));
    return m;
  }, [allEntries]);

  const members = useMemo(
    () => (selected?.memberIds ?? []).map(id => entryById.get(id)).filter(Boolean) as CodexEntry[],
    [selected, entryById],
  );

  // Baris hubungan dengan faksi LAIN (dua sinyal), terurut nama.
  const relationRows = useMemo<FactionRelationRow[]>(() => {
    if (!selected) return [];
    return factions
      .filter(f => f.id !== selected.id)
      .map(f => {
        const stat = relData.pairMap.get(pairKey(selected.id, f.id));
        return { faction: f, stat, sentiment: factionPairSentiment(stat) };
      })
      .sort((a, b) => a.faction.name.localeCompare(b.faction.name, 'id'));
  }, [selected, factions, relData]);

  const internal = useMemo(
    () => (selected ? relData.internal.get(selected.id) ?? {} : {}),
    [selected, relData],
  );

  // Kandidat calon anggota (entri non-anggota) untuk penambahan cepat.
  const nonMembers = useMemo(() => {
    if (!selected) return [];
    const memberSet = new Set(selected.memberIds);
    return (allEntries ?? [])
      .filter(e => e.id != null && e.id !== selected.id && !memberSet.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [selected, allEntries]);

  const nameOf = (id: number) => entryById.get(id)?.name ?? '(entri dihapus)';

  // --- Mutasi (tulis DB langsung; live-query menyegarkan) ---
  // Keanggotaan lewat tag: tags/factionTag tak masuk KB → tak perlu invalidateContextCache.
  const addMember = async (entryId: number) => {
    if (!selected) return;
    const e = entryById.get(entryId);
    if (!e) return;
    const tags = e.tags ?? [];
    if (tags.some(t => t.trim() === selected.tag)) return;
    await db.codex.update(entryId, { tags: [...tags, selected.tag] });
  };
  const removeMember = async (entryId: number) => {
    if (!selected) return;
    const e = entryById.get(entryId);
    if (!e) return;
    await db.codex.update(entryId, { tags: (e.tags ?? []).filter(t => t.trim() !== selected.tag) });
  };

  // Relasi DIDEKLARASIKAN antar entri faksi = tabel relationships biasa.
  const addDeclaredRelation = async (otherFactionId: number, type: string, description?: string) => {
    if (!selected || otherFactionId === selected.id) return;
    await db.relationships.add({
      projectId,
      sourceId: selected.id,
      targetId: otherFactionId,
      type,
      description: description?.trim() || undefined,
    });
  };
  const deleteRelation = async (id: number) => {
    await db.relationships.delete(id);
  };

  return {
    loading: allEntries === undefined || relationships === undefined,
    categories,
    factions,
    selected,
    selectedId,
    setSelectedId,
    members,
    relationRows,
    internal,
    nonMembers,
    nameOf,
    addMember,
    removeMember,
    addDeclaredRelation,
    deleteRelation,
  };
}
