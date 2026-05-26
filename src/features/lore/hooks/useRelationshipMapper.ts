import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';

export function useRelationshipMapper(projectId: number) {
  const characters = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).and(item => item.category === 'character').toArray()
  , [projectId]);

  const relationships = useLiveQuery(() => 
    db.relationships.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [type, setType] = useState('Friend');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-select first character if none is selected
  useEffect(() => {
    if (characters && characters.length > 0 && selectedCharacterId === null) {
      setSelectedCharacterId(characters[0].id!);
    }
  }, [characters, selectedCharacterId]);

  const selectedCharacter = useMemo(() => {
    return characters?.find(c => c.id === selectedCharacterId) || null;
  }, [characters, selectedCharacterId]);

  const filteredCharacters = useMemo(() => {
    if (!characters) return [];
    if (!searchQuery) return characters;
    return characters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [characters, searchQuery]);

  const groupedRelationships = useMemo(() => {
    if (!relationships || !selectedCharacterId) return {};
    
    // Find all relationships where the selected char is either source or target
    const rels = relationships.filter(r => r.sourceId === selectedCharacterId || r.targetId === selectedCharacterId);
    
    const groups: Record<string, typeof relationships> = {
      'Friend': [], 'Lover': [], 'Enemy': [], 'Ally': [], 'Other': []
    };
    
    rels.forEach(r => {
      if (groups[r.type]) {
        groups[r.type].push(r);
      } else {
        groups['Other'].push(r);
      }
    });
    
    return groups;
  }, [relationships, selectedCharacterId]);

  const hasAnyRelationships = Object.values(groupedRelationships).some(group => group.length > 0);

  const cancelAdding = () => {
    setIsAdding(false);
    setEditingId(null);
    setTargetId(null);
    setType('Friend');
    setDescription('');
  };

  const saveRelationship = async () => {
    if (!selectedCharacterId || !targetId || selectedCharacterId === targetId) return;
    
    if (editingId) {
      const existing = relationships?.find(r => r.id === editingId);
      if (existing) {
        const isSource = existing.sourceId === selectedCharacterId;
        await db.relationships.update(editingId, {
          sourceId: isSource ? selectedCharacterId : targetId,
          targetId: isSource ? targetId : selectedCharacterId,
          type,
          description: description.trim() || undefined
        });
      }
    } else {
      await db.relationships.add({
        projectId,
        sourceId: selectedCharacterId,
        targetId,
        type,
        description: description.trim() || undefined
      });
    }
    
    cancelAdding();
  };

  const startEditing = (rel: typeof relationships[0]) => {
    if (!rel) return;
    setEditingId(rel.id!);
    const otherId = rel.sourceId === selectedCharacterId ? rel.targetId : rel.sourceId;
    setTargetId(otherId);
    setType(rel.type);
    setDescription(rel.description || '');
    setIsAdding(true);
  };

  const deleteRelationship = async (id: number) => {
    await db.relationships.delete(id);
  };

  const getCharacterName = (id: number) => characters?.find(c => c.id === id)?.name || 'Unknown';

  return {
    characters,
    relationships,
    selectedCharacterId,
    setSelectedCharacterId,
    isAdding,
    setIsAdding,
    editingId,
    targetId,
    setTargetId,
    type,
    setType,
    description,
    setDescription,
    searchQuery,
    setSearchQuery,
    selectedCharacter,
    filteredCharacters,
    groupedRelationships,
    hasAnyRelationships,
    saveRelationship,
    startEditing,
    cancelAdding,
    deleteRelationship,
    getCharacterName
  };
}
