/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Tag, User, MapPin, Sparkles, BookOpen, Database, Search, Edit2, X, Check, Wand2, MessageSquareText, Link2 } from 'lucide-react';
import { CodexEntry, CodexCategory, Chapter } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { expandCodexEntry } from '../services/ai';
import { invalidateContextCache, getEntryAppearances } from '../services/contextEngine';
import { ScribbleAssistantPanel } from './ScribbleAssistantPanel';
import { useToast } from '../hooks/useToast';
import { useHighlightedSegments } from '../hooks/useHighlightedSegments';
import { useNavigation } from '../contexts/NavigationContext';

interface CodexPanelProps {
  projectId: number;
}

// Helper component to render descriptions with references auto-linked
function LinkifiedDescription({ text, allEntries }: { text: string; allEntries: CodexEntry[] }) {
  const renderMatch = useCallback((entry: CodexEntry, part: string, key: string) => (
    <span 
      key={key}
      className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded-md cursor-help border border-indigo-100 dark:border-indigo-900/50 relative group transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900"
    >
      {part}
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-slate-900 dark:bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 pointer-events-none border border-slate-700">
        <span className="block font-bold text-indigo-300 uppercase tracking-widest text-[10px] mb-1">{entry.category}</span>
        <span className="block font-serif line-clamp-3 opacity-90 leading-relaxed text-slate-200">{entry.description || 'No description available.'}</span>
      </span>
    </span>
  ), []);

  const highlightedContent = useHighlightedSegments(text, allEntries, renderMatch);

  return <span className="whitespace-pre-wrap">{highlightedContent}</span>;
}

function AppearancesList({ entry, projectId }: { entry: CodexEntry; projectId: number }) {
  const { setViewMode, setActiveChapterId } = useNavigation();
  const [appearances, setAppearances] = useState<Chapter[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAppearances = async () => {
    setLoading(true);
    try {
      const chapterIds = await getEntryAppearances(entry, projectId);
      const chapters = await db.chapters.bulkGet(chapterIds);
      setAppearances(chapters.filter(Boolean) as Chapter[]);
    } catch (err) {
      console.error('Failed to fetch appearances:', err);
    } finally {
      setLoading(false);
    }
  };

  const goToChapter = (id: number) => {
    setActiveChapterId(id);
    setViewMode('write');
  };

  if (!appearances && !loading) {
    return (
      <button 
        onClick={fetchAppearances}
        className="mt-3 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
      >
        <BookOpen size={12} /> Cek Kemunculan di Chapter
      </button>
    );
  }

  if (loading) {
    return (
      <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 animate-pulse flex items-center gap-1">
        <Sparkles size={12} className="animate-spin" /> Sedang mencari...
      </div>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">
        <BookOpen size={12} /> Muncul di {appearances?.length} Chapter:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {appearances?.length === 0 ? (
          <span className="text-[11px] text-slate-400 italic">Belum ditemukan di chapter mana pun.</span>
        ) : (
          appearances?.map(ch => (
            <button
              key={ch.id}
              onClick={() => goToChapter(ch.id!)}
              className="text-[11px] font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
            >
              {ch.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function CodexPanel({ projectId }: CodexPanelProps) {
  const { toast } = useToast();
  
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<CodexCategory | 'all'>('all');
  const [isExpanding, setIsExpanding] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkingTarget, setLinkingTarget] = useState<number | null>(null);
  const [linkingType, setLinkingType] = useState<string>('Friend');

  const [formData, setFormData] = useState<Partial<CodexEntry>>({
    name: '',
    category: 'character',
    description: '',
    aliases: [],
    tags: []
  });

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
    setFormData({ name: '', category: 'character', description: '', aliases: [], tags: [] });
    setEditingId(null);
    setIsAdding(true);
    setTimeout(() => {
      document.querySelector('[data-codex-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const startEditing = (entry: CodexEntry) => {
    setFormData({
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

  const saveEntry = async () => {
    if (!formData.name) return;
    
    if (editingId) {
      await db.codex.update(editingId, {
        name: formData.name,
        category: formData.category || 'character',
        description: formData.description || '',
        aliases: formData.aliases || [],
        tags: formData.tags || []
      });
    } else {
      await db.codex.add({
        projectId,
        name: formData.name,
        category: formData.category || 'character',
        description: formData.description || '',
        aliases: formData.aliases || [],
        tags: formData.tags || []
      } as CodexEntry);
    }
    
    await invalidateContextCache();
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', category: 'character', description: '', aliases: [], tags: [] });
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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

  const handleExpand = async () => {
    if (!formData.name) return;
    setIsExpanding(true);
    try {
      const expandedDesc = await expandCodexEntry(
        formData.name,
        formData.category || 'character',
        formData.description || '',
        bibleRules || []
      );
      setFormData(prev => ({ ...prev, description: expandedDesc }));
    } catch (e) {
      toast.error('Failed to expand: ' + (e as Error).message);
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 italic">World Codex</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium tracking-wide">Data pembangunan dunia untuk injeksi konteks AI.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={startAdding}
            className="self-start md:self-auto flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95"
          >
            <Plus size={16} /> Entri Baru
          </button>
        )}
      </div>

      {!isAdding && (entries?.length ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search codex by name, alias, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>
          <select
             value={filterCategory}
             onChange={(e) => setFilterCategory(e.target.value as any)}
             className="w-full sm:w-48 py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
          >
            <option value="all">All Categories</option>
            <option value="character">Characters</option>
            <option value="location">Locations</option>
            <option value="magic">Magic Systems</option>
            <option value="item">Items & Artifacts</option>
            <option value="other">Other Lore</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              data-codex-form
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg col-span-full overflow-hidden"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {editingId ? <Edit2 size={18} className="text-indigo-500" /> : <Plus size={18} className="text-indigo-500" />}
                  {editingId ? 'Edit Entry' : 'New Codex Entry'}
                </h3>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Entry Name *</label>
                      <input 
                        autoFocus
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                        placeholder="e.g. The Grand City"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                      <select 
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value as CodexCategory})}
                      >
                        <option value="character">Character</option>
                        <option value="location">Location</option>
                        <option value="magic">Magic System</option>
                        <option value="item">Item/Artifact</option>
                        <option value="other">Other Lore</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Aliases</label>
                      <input 
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                        placeholder="Comma separated (e.g. City of Lights)"
                        value={formData.aliases?.join(', ')}
                        onChange={e => setFormData({...formData, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Description (Markdown Supported) *</label>
                      <button
                        onClick={handleExpand}
                        disabled={isExpanding || !formData.name}
                        className={cn(
                          "flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all border",
                          isExpanding 
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent animate-pulse" 
                            : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        title={!formData.name ? "Enter a name first to expand" : "Generate detailed lore using AI based on Name and Category"}
                      >
                        <Wand2 size={12} className={isExpanding ? "animate-spin" : ""} />
                        {isExpanding ? "Expanding..." : "Expand with AI"}
                      </button>
                    </div>
                    <textarea 
                      className="w-full flex-1 min-h-[160px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100 resize-y font-serif leading-relaxed"
                      placeholder="Describe their appearance, history, or unique traits to provide context for the AI..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={cancelEdit}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveEntry}
                    disabled={!formData.name?.trim() || !formData.description?.trim()}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <Check size={16} /> {editingId ? 'Save Changes' : 'Create Entry'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredEntries.map(entry => (
          <motion.div 
            layout
            key={entry.id} 
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all relative flex flex-col col-span-1"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900 transition-colors">
                    <CategoryIcon category={entry.category} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{entry.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                      {entry.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleToggleLinking(entry.id!)}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
                    title="Add Bond"
                  >
                    <Link2 size={16} />
                  </button>
                  <button 
                    onClick={() => startEditing(entry)}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
                    title="Ubah Entri"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => deleteEntry(entry.id!)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-all"
                    title="Hapus Entri"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <AnimatePresence>
                {linkingId === entry.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-200 dark:border-slate-700 flex flex-col gap-3 shadow-inner">
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={linkingType}
                          onChange={e => setLinkingType(e.target.value)}
                        >
                          <option value="Friend">Teman</option>
                          <option value="Enemy">Musuh</option>
                          <option value="Family">Keluarga</option>
                          <option value="Lover">Kekasih</option>
                          <option value="Ally">Sekutu</option>
                          <option value="Resides In">Tinggal di</option>
                          <option value="Owns">Memiliki</option>
                          <option value="Other">Lainnya</option>
                        </select>
                        <select
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none max-w-[120px]"
                          value={linkingTarget || ''}
                          onChange={e => setLinkingTarget(Number(e.target.value))}
                        >
                          <option value="">Pilih...</option>
                          {entries?.filter(e => e.id !== entry.id).map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end">
                         <button 
                           onClick={() => addBond(entry.id!)}
                           disabled={!linkingTarget}
                           className="text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition shadow-sm active:scale-95"
                         >
                           Simpan Hubungan
                         </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed font-serif">
                  {entry.description ? (
                    <LinkifiedDescription text={entry.description} allEntries={entries || []} />
                  ) : (
                    <span className="italic opacity-60">No description provided.</span>
                  )}
                </div>
                <AppearancesList entry={entry} projectId={projectId} />
              </div>

              {(entry.aliases?.length ?? 0) > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                    <Tag size={12} /> Aliases:
                  </span>
                  {entry.aliases.map(a => (
                    <span key={a} className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {relationships && relationships.filter(r => r.sourceId === entry.id || r.targetId === entry.id).length > 0 && (
                <div className="mt-3 pt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                    <Link2 size={12} /> Bonds:
                  </span>
                  {relationships.filter(r => r.sourceId === entry.id || r.targetId === entry.id).map(r => {
                    const isSource = r.sourceId === entry.id;
                    const otherId = isSource ? r.targetId : r.sourceId;
                    const otherEntry = entries?.find(e => e.id === otherId);
                    if (!otherEntry) return null;
                    return (
                      <span key={r.id} className="group/bond text-[11px] font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1">
                        {r.type} <span className="opacity-50">to</span> {otherEntry.name}
                        <button onClick={() => deleteRelationship(r.id!)} className="opacity-0 group-hover/bond:opacity-100 text-indigo-400 hover:text-red-500 transition ml-1 shrink-0">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {entries?.length === 0 && !isAdding && (
          <div className="col-span-full py-24 px-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <Database className="text-indigo-500 dark:text-indigo-400" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Your World is Empty</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
              Start building your lore database to give the AI context about your characters, locations, and magical systems.
            </p>
            <button 
              onClick={startAdding}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all active:scale-95"
            >
              <Plus size={18} /> Buat Entri Pertama
            </button>
          </div>
        )}
        
        {entries && entries.length > 0 && filteredEntries.length === 0 && !isAdding && (
          <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Search size={32} className="mx-auto mb-4 opacity-50" />
            <p>No entries found matching your search criteria.</p>
            <button 
              onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}
              className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Floating AI Button & Panel */}
      <AnimatePresence>
        {!isAssistantOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsAssistantOpen(true)}
            className="fixed bottom-6 right-6 z-[60] p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all"
            title="Open AI Assistant"
          >
            <MessageSquareText size={24} />
          </motion.button>
        )}
        
        {isAssistantOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-[60] w-[340px] h-[600px] max-h-[85vh] rounded-2xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border border-slate-200 dark:border-slate-800"
          >
            <ScribbleAssistantPanel 
              projectId={projectId} 
              currentText="" 
              onClose={() => setIsAssistantOpen(false)}
              viewMode="codex"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId !== null && (
           <div 
             className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
             onClick={() => setConfirmDeleteId(null)}
           >
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full"
               onClick={(e) => e.stopPropagation()}
             >
               <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Hapus Entri?</h3>
               <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Apakah Anda yakin ingin menghapus entri ini? Tindakan ini tidak dapat dibatalkan.</p>
               <div className="flex gap-3 justify-end">
                 <button 
                   onClick={() => setConfirmDeleteId(null)}
                   className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                 >
                   Batal
                 </button>
                 <button 
                   onClick={confirmDelete}
                   className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm text-sm"
                 >
                   Hapus
                 </button>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryIcon({ category }: { category: CodexCategory }) {
  switch (category) {
    case 'character': return <User size={20} className="text-indigo-500" />;
    case 'location': return <MapPin size={20} className="text-emerald-500" />;
    case 'magic': return <Sparkles size={20} className="text-amber-500" />;
    case 'item': return <Tag size={20} className="text-rose-500" />;
    default: return <BookOpen size={20} className="text-slate-400 dark:text-slate-500" />;
  }
}
