import { useState, useMemo } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { CodexEntry, CodexCategory } from '@/src/types';
import { invalidateContextCache } from '@/src/services/contextEngine';

export function useCodexPanel(projectId: number) {
  const entries = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const bibleRules = useLiveQuery(() => 
    db.bible.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const relationships = useLiveQuery(() => 
    db.relationships.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<CodexCategory | 'all'>('all');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkingTarget, setLinkingTarget] = useState<number | null>(null);
  const [linkingType, setLinkingType] = useState<string>('Friend');

  const [initialData, setInitialData] = useState<Partial<CodexEntry>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter(entry => {
      const matchesSearch = 
        entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.aliases?.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [entries, searchQuery, filterCategory]);

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
      await db.codex.delete(confirmDeleteId);
      if (linkingId === confirmDeleteId) {
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
    
    isAdding,
    editingId,
    selectedEntry,
    setSelectedEntry,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
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
