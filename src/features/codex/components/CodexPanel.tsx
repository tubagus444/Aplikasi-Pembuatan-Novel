import React from 'react';
import { Plus, Search, MessageSquareText, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScribbleAssistantPanel } from '@/src/features/assistant/components/ScribbleAssistantPanel';
import { VirtuosoGrid } from 'react-virtuoso';

import { CodexForm } from '@/src/features/codex/components/CodexForm';
import { CodexCard } from '@/src/features/codex/components/CodexCard';
import { CodexDetailModal } from '@/src/features/codex/components/CodexDetailModal';
import { useCodexPanel } from '@/src/features/codex/hooks/useCodexPanel';

interface CodexPanelProps {
  projectId: number;
}

export function CodexPanel({ projectId }: CodexPanelProps) {
  const {
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
  } = useCodexPanel(projectId);

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col pt-1">
      <div className="shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-6">
          <div>
            <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 italic">Kamus Data (Codex)</h2>
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
                placeholder="Cari entri Codex berdasarkan nama, alias, atau deskripsi..."
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
              <option value="all">Semua Kategori</option>
              <option value="character">Karakter</option>
              <option value="location">Lokasi</option>
              <option value="magic">Sistem Sihir</option>
              <option value="item">Item & Artefak</option>
              <option value="other">Lore Lainnya</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence>
          {isAdding && (
            <div className="w-full pb-10 overflow-y-auto h-full px-2" data-codex-form>
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

        {!isAdding && filteredEntries.length > 0 && (
           <VirtuosoGrid
             style={{ height: '100%' }}
             totalCount={filteredEntries.length}
             data={filteredEntries}
             components={{
               List: React.forwardRef((props, ref) => (
                 <div {...props} ref={ref as React.Ref<HTMLDivElement>} className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 pb-24" />
               )),
               Item: ({ children, ...props }) => (
                 <div {...props}>
                   {children}
                 </div>
               )
             }}
             itemContent={(index, entry) => (
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
                 onSelect={setSelectedEntry}
                 onDeleteRelationship={deleteRelationship}
               />
             )}
           />
        )}

        {entries?.length === 0 && !isAdding && (
          <div className="py-24 px-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <Database className="text-indigo-500 dark:text-indigo-400" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Dunia Anda Masih Kosong</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
              Mulailah membangun database lore Anda untuk memberi AI konteks tentang karakter, lokasi, dan sistem sihir Anda.
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
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Search size={32} className="mx-auto mb-4 opacity-50" />
            <p>Tidak ada entri yang cocok dengan kriteria pencarian Anda.</p>
            <button 
              onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}
              className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
            >
              Cari Ulang
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
            title="Buka Studio Asisten AI"
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
              codexEntries={entries}
              bibleRules={bibleRules}
              relationships={relationships}
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

      <AnimatePresence>
        {selectedEntry && (
          <CodexDetailModal
            entry={selectedEntry}
            entries={entries || []}
            relationships={relationships || []}
            projectId={projectId}
            onClose={() => setSelectedEntry(null)}
            onEdit={(entry) => {
              setSelectedEntry(null);
              startEditing(entry);
            }}
            onDelete={(id) => {
              setSelectedEntry(null);
              deleteEntry(id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
