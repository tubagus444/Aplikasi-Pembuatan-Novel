import React, { useState, useMemo } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, MessageSquareText, Database } from 'lucide-react';
import { CodexEntry, CodexCategory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { invalidateContextCache } from '../services/contextEngine';
import { ScribbleAssistantPanel } from './ScribbleAssistantPanel';
import { useNavigation } from '../contexts/NavigationContext';

import { CodexForm } from './codex/CodexForm';
import { CodexCard } from './codex/CodexCard';

interface CodexPanelProps {
  projectId: number;
}

export function CodexPanel({ projectId }: CodexPanelProps) {
  const { setViewMode } = useNavigation();
  
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
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkingTarget, setLinkingTarget] = useState<number | null>(null);
  const [linkingType, setLinkingType] = useState<string>('Friend');

  const [initialData, setInitialData] = useState<Partial<CodexEntry>>({});

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
            <div className="col-span-full">
              <CodexForm 
                initialData={initialData}
                editingId={editingId}
                bibleRules={bibleRules || []}
                onSave={handleSaveEntry}
                onCancel={cancelEdit}
              />
            </div>
          )}
        </AnimatePresence>

        {filteredEntries.map(entry => (
          <CodexCard
            key={entry.id}
            entry={entry}
            entries={entries || []}
            relationships={relationships || []}
            projectId={projectId}
            linkingId={linkingId}
            linkingTarget={linkingTarget}
            linkingType={linkingType}
            onSetLinkingTarget={setLinkingTarget}
            onSetLinkingType={setLinkingType}
            onToggleLinking={handleToggleLinking}
            onAddBond={addBond}
            onEdit={startEditing}
            onDelete={deleteEntry}
            onDeleteRelationship={deleteRelationship}
          />
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
