import { useState, useMemo, useEffect } from 'react';
import { db } from '@/src/db';
import { useOptimizedLiveQuery } from '@/src/hooks/useOptimizedLiveQuery';
import { CodexEntry, CodexCategory } from '@/src/types';
import { invalidateContextCache } from '@/src/services/contextEngine';

export type CodexSort = 'name-asc' | 'name-desc' | 'category' | 'recent' | 'oldest';

export function useCodexPanel(projectId: number) {
  const entries = useOptimizedLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const bibleRules = useOptimizedLiveQuery(() => 
    db.bible.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const relationships = useOptimizedLiveQuery(() => 
    db.relationships.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Nilai pencarian yang ditunda agar pemfilteran (di atas seluruh codex) tidak
  // berjalan tiap ketukan tombol pada codex besar.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<CodexCategory | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<CodexSort>('name-asc');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkingTarget, setLinkingTarget] = useState<number | null>(null);
  const [linkingType, setLinkingType] = useState<string>('Friend');

  const [initialData, setInitialData] = useState<Partial<CodexEntry>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Daftar tag unik (terurut) untuk dropdown filter.
  const allTags = useMemo(() => {
    if (!entries) return [];
    const set = new Set<string>();
    entries.forEach(e => e.tags?.forEach(t => { if (t) set.add(t); }));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [entries]);

  // Jumlah entri per kategori + total, untuk ringkasan di header.
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    entries?.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return { total: entries?.length ?? 0, byCategory: counts };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    const q = debouncedQuery.toLowerCase();
    const result = entries.filter(entry => {
      const matchesSearch =
        entry.name.toLowerCase().includes(q) ||
        entry.description?.toLowerCase().includes(q) ||
        entry.aliases?.some(a => a.toLowerCase().includes(q)) ||
        entry.tags?.some(t => t.toLowerCase().includes(q));

      const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
      const matchesTag = filterTag === 'all' || (entry.tags?.includes(filterTag) ?? false);

      return matchesSearch && matchesCategory && matchesTag;
    });

    const sorted = [...result];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'id'));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, 'id'));
        break;
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'id'));
        break;
      case 'recent':
        // id auto-increment → id lebih besar = lebih baru.
        sorted.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        break;
      case 'oldest':
        sorted.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        break;
    }
    return sorted;
  }, [entries, debouncedQuery, filterCategory, filterTag, sortBy]);

  const startAdding = () => {
    setInitialData({ name: '', category: 'character', description: '', aliases: [], tags: [] });
    setEditingId(null);
    setIsAdding(true);
    setTimeout(() => {
      document.querySelector('[data-codex-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const startEditing = (entry: CodexEntry) => {
    setInitialData({
      name: entry.name,
      category: entry.category,
      description: entry.description,
      aliases: entry.aliases || [],
      tags: entry.tags || []
    });
    setEditingId(entry.id!);
    setIsAdding(true);
    setTimeout(() => {
      document.querySelector('[data-codex-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSaveEntry = async (data: Partial<CodexEntry>) => {
    if (!data.name) return;
    
    if (editingId) {
      await db.codex.update(editingId, {
        name: data.name,
        category: data.category || 'character',
        description: data.description || '',
        aliases: data.aliases || [],
        tags: data.tags || []
      });
    } else {
      await db.codex.add({
        projectId,
        name: data.name,
        category: data.category || 'character',
        description: data.description || '',
        aliases: data.aliases || [],
        tags: data.tags || []
      } as CodexEntry);
    }
    
    await invalidateContextCache();
    setIsAdding(false);
    setEditingId(null);
    setInitialData({});
  };

  const deleteEntry = async (id: number) => {
    setConfirmDeleteId(id);
  };
  
  const confirmDelete = async () => {
    if (confirmDeleteId !== null) {
      const id = confirmDeleteId;
      // Hapus entri beserta data turunannya secara atomik agar tidak menyisakan
      // relasi/embedding yatim yang menunjuk entri yang sudah tiada.
      await db.transaction('rw', db.codex, db.relationships, db.embeddings, async () => {
        await db.codex.delete(id);
        await db.relationships.where('sourceId').equals(id).delete();
        await db.relationships.where('targetId').equals(id).delete();
        await db.embeddings.where('codexId').equals(id).delete();
      });
      // Lore berubah → cache konteks AI (termasuk indeks semantik) harus disegarkan.
      await invalidateContextCache(true);
      if (linkingId === id) {
        setLinkingId(null);
        setLinkingTarget(null);
      }
      setConfirmDeleteId(null);
    }
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const addBond = async (sourceId: number) => {
    if (!linkingTarget) return;
    await db.relationships.add({
      projectId,
      sourceId,
      targetId: linkingTarget,
      type: linkingType
    });
    setLinkingId(null);
    setLinkingTarget(null);
  };

  const deleteRelationship = async (id: number) => {
    await db.relationships.delete(id);
  };

  const handleToggleLinking = (id: number) => {
    setLinkingId(prev => {
      if (prev === id) return null;
      setLinkingTarget(null);
      setLinkingType('Friend');
      return id;
    });
  };

  return {
    entries,
    filteredEntries,
    bibleRules,
    relationships,
    allTags,
    stats,

    isAdding,
    editingId,
    selectedEntry,
    setSelectedEntry,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterTag,
    setFilterTag,
    sortBy,
    setSortBy,
    isAssistantOpen,
    setIsAssistantOpen,
    
    linkingId,
    linkingTarget,
    setLinkingTarget,
    linkingType,
    setLinkingType,
    
    initialData,
    confirmDeleteId,
    setConfirmDeleteId,
    
    startAdding,
    startEditing,
    handleSaveEntry,
    deleteEntry,
    confirmDelete,
    cancelEdit,
    addBond,
    deleteRelationship,
    handleToggleLinking
  };
}
