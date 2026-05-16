import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Trash2, Edit2, Link as LinkIcon, Users, Heart, Sword, ShieldAlert, ArrowRight, Search, UserCircle2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RelationshipMapperProps {
  projectId: number;
}

const RELATION_TYPES = [
  { label: 'Friend', icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', activeClass: 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-500/20', border: 'border-blue-200 dark:border-blue-900/50', hex: '#3b82f6' },
  { label: 'Lover', icon: Heart, color: 'text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-400', activeClass: 'border-pink-500 ring-1 ring-pink-500 bg-pink-50/50 dark:bg-pink-500/20', border: 'border-pink-200 dark:border-pink-900/50', hex: '#ec4899' },
  { label: 'Enemy', icon: Sword, color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400', activeClass: 'border-red-500 ring-1 ring-red-500 bg-red-50/50 dark:bg-red-500/20', border: 'border-red-200 dark:border-red-900/50', hex: '#ef4444' },
  { label: 'Ally', icon: ShieldAlert, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', activeClass: 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/20', border: 'border-emerald-200 dark:border-emerald-900/50', hex: '#10b981' },
  { label: 'Other', icon: LinkIcon, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', activeClass: 'border-slate-500 ring-1 ring-slate-500 bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-800', hex: '#94a3b8' },
];

export function RelationshipMapper({ projectId }: RelationshipMapperProps) {
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
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-select first character if none is selected
  React.useEffect(() => {
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

  const saveRelationship = async () => {
    if (!selectedCharacterId || !targetId || selectedCharacterId === targetId) return;
    
    if (editingId) {
      const existing = relationships?.find(r => r.id === editingId);
      if (existing) {
        const isSource = existing.sourceId === selectedCharacterId;
        await db.relationships.update(editingId, {
          sourceId: isSource ? selectedCharacterId : targetId,
          targetId: isSource ? targetId : selectedCharacterId,
          type
        });
      }
    } else {
      await db.relationships.add({
        projectId,
        sourceId: selectedCharacterId,
        targetId,
        type
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
    setIsAdding(true);
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setEditingId(null);
    setTargetId(null);
    setType('Friend');
  };

  const deleteRelationship = async (id: number) => {
    await db.relationships.delete(id);
  };

  const getCharacterName = (id: number) => characters?.find(c => c.id === id)?.name || 'Unknown';

  const renderRelationshipCards = (typeObj: typeof RELATION_TYPES[0], rels: typeof relationships) => {
    if (!rels || rels.length === 0) return null;
    const TypeIcon = typeObj.icon;
    
    return (
      <div key={typeObj.label} className="mb-8">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
          <div className={`p-1.5 rounded-md ${typeObj.color}`}>
            <TypeIcon size={16} />
          </div>
          {typeObj.label}
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 py-0.5 px-2 rounded-full text-[10px] font-bold ml-2">
            {rels.length}
          </span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rels.map(rel => {
            const isSource = rel.sourceId === selectedCharacterId;
            const otherCharId = isSource ? rel.targetId : rel.sourceId;
            const otherCharName = getCharacterName(otherCharId);
            
            return (
              <div 
                key={rel.id} 
                className={`group flex flex-col justify-between p-4 bg-white dark:bg-slate-900 border ${typeObj.border} rounded-2xl hover:shadow-md transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-sm shrink-0">
                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                        {otherCharName.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm line-clamp-1">
                        {otherCharName}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                        {!isSource && <ArrowRight size={10} className="rotate-180" />}
                        {typeObj.label}
                        {isSource && <ArrowRight size={10} />}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(rel)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-all"><Edit2 size={14} /></button>
                    <button onClick={() => deleteRelationship(rel.id!)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="mb-8 p-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="text-indigo-600" size={20} />
            Karakter & Hubungan
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Character List */}
        <div className="lg:col-span-1 flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search characters..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredCharacters?.map(char => (
              <button
                key={char.id}
                onClick={() => {
                  setSelectedCharacterId(char.id!);
                  cancelAdding();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  selectedCharacterId === char.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 border shadow-sm'
                    : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  selectedCharacterId === char.id 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                   <span className="font-bold text-xs">
                     {char.name.substring(0, 2).toUpperCase()}
                   </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm truncate font-medium ${selectedCharacterId === char.id ? 'text-indigo-900 dark:text-indigo-300 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                    {char.name}
                  </h4>
                </div>
              </button>
            ))}
            
            {filteredCharacters?.length === 0 && (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                No characters found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Main Profile Panel */}
        <div className="lg:col-span-3 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden shadow-inner">
          {selectedCharacter ? (
            <AnimatePresence mode="wait">
              <motion.div 
                key={selectedCharacter.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full overflow-y-auto custom-scrollbar"
              >
                {/* Header */}
                <div className="relative p-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <div className="absolute top-0 left-0 w-full h-32 bg-slate-50 dark:bg-slate-800/30" />
                  <div className="relative z-10 flex items-end gap-6 pt-12">
                    <div className="w-24 h-24 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-4 border-white dark:border-slate-900 shadow-xl flex items-center justify-center shrink-0">
                       <UserCircle2 size={48} className="text-indigo-600/60 dark:text-indigo-400/60" />
                    </div>
                    <div className="flex-1 pb-2">
                       <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                         {selectedCharacter.name}
                       </h2>
                       <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 font-medium">
                         <LinkIcon size={14} className="text-indigo-500" />
                         {relationships?.filter(r => r.sourceId === selectedCharacter.id || r.targetId === selectedCharacter.id).length || 0} Koneksi
                       </p>
                    </div>
                    <div className="pb-2">
                      <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                      >
                        <UserPlus size={16} />
                        Koneksi Baru
                      </button>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 p-8">
                  {/* Add Bond Form */}
                  <AnimatePresence>
                    {isAdding && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="overflow-hidden mb-8"
                      >
                        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 shadow-md space-y-6">
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg border-b border-border pb-3">
                            {editingId ? 'Edit Connection' : `Create connection for ${selectedCharacter.name}`}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Target Character Dropdown */}
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Connect With</label>
                              <select 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow"
                                value={targetId || ''}
                                onChange={e => setTargetId(Number(e.target.value))}
                              >
                                <option value="">Select Character...</option>
                                {characters?.filter(c => c.id !== selectedCharacter?.id).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Relationship Type Map */}
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Bond Type</label>
                              <div className="grid grid-cols-5 gap-2">
                                {RELATION_TYPES.map(r => (
                                  <button
                                    key={r.label}
                                    onClick={() => setType(r.label)}
                                    className={`flex flex-col flex-1 items-center justify-center p-3 rounded-xl transition-all border ${
                                      type === r.label 
                                        ? r.activeClass
                                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                    title={r.label}
                                  >
                                    <r.icon size={18} className="mb-1" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider truncate w-full text-center">{r.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                            <button 
                              onClick={cancelAdding}
                              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={saveRelationship}
                              disabled={!targetId}
                              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                              {editingId ? 'Save Changes' : 'Create Bond'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Relationship Sections */}
                  {hasAnyRelationships ? (
                    <div>
                      {RELATION_TYPES.map(rt => renderRelationshipCards(rt, groupedRelationships[rt.label]))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600 border-4 border-white dark:border-slate-900 border-dashed">
                        <Users size={40} />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No connections documented</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Create the first bond for {selectedCharacter.name} to map out their place in the story.</p>
                      {!isAdding && (
                         <button 
                           onClick={() => setIsAdding(true)}
                           className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
                         >
                           <UserPlus size={16} />
                           Add a Bond
                         </button>
                      )}
                    </div>
                  )}

                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
               <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600">
                 <Users size={48} />
               </div>
               <h4 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Character Hub</h4>
               <p className="text-slate-500 dark:text-slate-400 max-w-sm">Select a character from the list to view and manage their relationships.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
