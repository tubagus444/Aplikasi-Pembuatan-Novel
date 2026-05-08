/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Sparkles, 
  Loader2, 
  MessageSquareText, 
  X, 
  ScrollText, 
  Bold, 
  Italic, 
  Type, 
  Tag,
  History,
  GripVertical,
  Gauge,
  Highlighter,
  Undo,
  Redo
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRelevantContext } from '../services/contextEngine';
import { processRewrite } from '../services/aiService';
import { cn } from '../lib/utils';
import { AIAssistantPanel } from './AIAssistantPanel';
import { SnapshotPanel } from './SnapshotPanel';
import { TimelinePanel } from './TimelinePanel';
import { ProseInsights } from './ProseInsights';
import { SelectionFloatingMenu } from './SelectionFloatingMenu';
import { CodexEntry } from '../types';

// Tiptap Imports
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { Extension } from '@tiptap/core';

// Custom Keymap Extension
const CustomAIKeymap = Extension.create({
  name: 'customAIKeymap',
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        // We'll handle this in the component via commands if possible
        // but for now let's just use it as a trigger
        return true;
      },
      'Mod-b': ({ editor }) => editor.commands.toggleBold(),
      'Mod-i': ({ editor }) => editor.commands.toggleItalic(),
    }
  },
});

interface NovelEditorProps {
  chapterId: number;
  projectId: number;
  isFocusMode?: boolean;
}

/// Floating menu moved to SelectionFloatingMenu.tsx

export function NovelEditor({ chapterId, projectId, isFocusMode }: NovelEditorProps) {
  const chapter = useLiveQuery(() => db.chapters.get(chapterId), [chapterId]);
  const [title, setTitle] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [activeInfoPopup, setActiveInfoPopup] = useState<CodexEntry | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const customActions = useLiveQuery(() => 
    db.aiActions.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const codexEntries = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  // Tiptap Editor Initialization
  const codexEntriesRef = useRef<CodexEntry[]>([]);
  
  useEffect(() => {
    codexEntriesRef.current = codexEntries || [];
  }, [codexEntries]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      CustomAIKeymap,
      Placeholder.configure({
        placeholder: 'Mulai menulis cerita Anda...',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }) => {
            const entries = codexEntriesRef.current;
            return entries
              .filter(item => 
                item.name.toLowerCase().startsWith(query.toLowerCase()) ||
                item.aliases?.some(a => a.toLowerCase().startsWith(query.toLowerCase()))
              )
              .slice(0, 5);
          },
          render: () => {
            let popup: HTMLDivElement | null = null;
            return {
              onStart: (props: any) => {
                if (popup) { popup.remove(); }
                popup = document.createElement('div');
                popup.className = 'fixed z-[9999] bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col min-w-[200px] py-1 text-sm text-slate-100 font-sans overflow-hidden';
                
                props.items.forEach((item: any, index: number) => {
                  const btn = document.createElement('button');
                  btn.className = 'text-left px-3 py-2 hover:bg-slate-800 transition-colors w-full font-bold flex flex-col gap-0.5';
                  btn.innerHTML = `<span>${item.name}</span><span class="text-[10px] text-slate-400 font-normal uppercase tracking-widest">${item.category}</span>`;
                  btn.onclick = () => {
                    props.command({ id: item.name });
                  };
                  popup?.appendChild(btn);
                });
                
                if (props.items.length === 0) {
                   const span = document.createElement('span');
                   span.className = 'px-3 py-2 text-slate-500 italic text-xs';
                   span.innerText = 'No exact matches...';
                   popup.appendChild(span);
                }

                if (props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    popup.style.left = rect.left + 'px';
                    popup.style.top = (rect.bottom + 5) + 'px';
                  }
                }
                document.body.appendChild(popup);
              },
              onUpdate: (props: any) => {
                if (!popup) return;
                popup.innerHTML = '';
                props.items.forEach((item: any, index: number) => {
                   const btn = document.createElement('button');
                   btn.className = 'text-left px-3 py-2 hover:bg-slate-800 transition-colors w-full font-bold flex flex-col gap-0.5';
                   btn.innerHTML = `<span>${item.name}</span><span class="text-[10px] text-slate-400 font-normal uppercase tracking-widest">${item.category}</span>`;
                   btn.onclick = () => {
                     props.command({ id: item.name });
                   };
                   popup?.appendChild(btn);
                 });
                 if (props.items.length === 0) {
                   const span = document.createElement('span');
                   span.className = 'px-3 py-2 text-slate-500 italic text-xs';
                   span.innerText = 'No exact matches...';
                   popup.appendChild(span);
                 }
                if (props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    popup.style.left = rect.left + 'px';
                    popup.style.top = (rect.bottom + 5) + 'px';
                  }
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === 'Escape') {
                  if (popup) {
                    popup.remove();
                    popup = null;
                  }
                  return true;
                }
                // Enter handling would logically go here but tiptap handles it if command is invoked. 
                // A full keyboard nav requires tracking selectedIndex, for simplicity we skip full arrow navigation.
                return false;
              },
              onExit: () => {
                if (popup) {
                  popup.remove();
                  popup = null;
                }
              }
            };
          },
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('Menyimpan...');
      saveTimeoutRef.current = setTimeout(() => {
        db.chapters.update(chapterId, { content: html, lastModified: Date.now() }).then(() => {
          setSaveStatus('Tersimpan');
          setTimeout(() => setSaveStatus(''), 2000);
        });
      }, 1000);
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative w-full font-serif text-lg leading-relaxed text-foreground bg-transparent focus:outline-none min-h-[500px]"
        ),
      },
    },
  }, []); // Empty deps to prevent unmount/remount flickering

  const [saveStatus, setSaveStatus] = useState('');

  // Is Typewriter mode toggle affect classes dynamically
  useEffect(() => {
    if (editor) {
      if (isTypewriterMode) {
        editor.view.dom.classList.add('pt-[40vh]', 'pb-[40vh]');
        editor.view.dom.classList.remove('pb-48', 'pt-0');
      } else {
        editor.view.dom.classList.remove('pt-[40vh]', 'pb-[40vh]');
        editor.view.dom.classList.add('pb-48', 'pt-0');
      }
    }
  }, [editor, isTypewriterMode]);

  // Load chapter data manually when ID changes to avoid full reconstruction
  useEffect(() => {
    if (chapter && editor) {
      if (editor.getHTML() !== chapter.content) {
        // preserve history if jumping between chapters? actually we probably want to clear history, but since we don't use full history extension cross-session, just set content.
        editor.commands.setContent(chapter.content);
      }
      if (title !== chapter.title) {
         setTitle(chapter.title);
      }
    }
  }, [chapter?.id, editor]); // intentionally omitted chapter.title so it doesn't revert user typings

  // Handle auto-scroll for typewriter mode
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      if (isTypewriterMode && containerRef.current) {
        const { view } = editor;
        const { selection } = view.state;
        try {
          const coords = view.coordsAtPos(selection.from);
          const containerRect = containerRef.current.getBoundingClientRect();
          const relativeTop = coords.top - containerRect.top + containerRef.current.scrollTop;
          const targetScroll = relativeTop - containerRef.current.clientHeight / 2;
          containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } catch(e) {}
      }
    };
    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    }
  }, [editor, isTypewriterMode]);

  if (chapter === undefined) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white dark:bg-slate-900">
        <Loader2 size={32} className="animate-spin mb-4 opacity-20" />
        <p className="font-serif italic text-lg">Synchronising Manuscript...</p>
      </div>
    );
  }

  if (chapter === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white dark:bg-slate-900">
        <ScrollText size={48} className="mb-4 opacity-20" />
        <p className="font-serif italic text-lg text-center px-8">This chapter has been removed.<br/>Please select another path from the outline.</p>
      </div>
    );
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    db.chapters.update(chapterId, { title: newTitle });
  };

  const runAiAction = async (action: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (selectedText.length < 5) return;

    setIsAiProcessing(true);
    try {
      const allCodex = await db.codex.where('projectId').equals(projectId).toArray();
      const BibleRules = await db.bible.where('projectId').equals(projectId).toArray();
      const relevantCodex = getRelevantContext(selectedText, allCodex);

      const result = await processRewrite({
        action,
        selection: selectedText,
        bibleRules: BibleRules,
        codexEntries: relevantCodex,
        prompt: ''
      });

      editor.commands.insertContentAt({ from, to }, result);
    } catch (err) {
      console.error(err);
      alert('AI Rewrite failed. Please try again.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="flex h-full relative overflow-hidden bg-white dark:bg-slate-900">
      {/* Editor Area */}
      <div ref={containerRef} className="flex-1 flex flex-col relative overflow-y-auto scroll-smooth custom-scrollbar">
        
        {/* Editor Surface */}
        <div className={cn(
          "w-full max-w-2xl mx-auto flex flex-col min-h-full px-8 sm:px-0 transition-all duration-700",
          isFocusMode && "max-w-xl"
        )}>
          {/* Sticky Header: Title + Toolbar */}
          <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm pt-8 pb-4 mb-4 border-b border-transparent group-focus-within:border-slate-100 dark:group-focus-within:border-slate-800 transition-all">
            <div className="mb-6 group">
              <input 
                type="text" 
                value={title}
                onChange={handleTitleChange}
                placeholder="Judul Bab..."
                className="w-full text-4xl font-serif font-bold text-foreground focus:outline-none placeholder:text-slate-200 dark:placeholder:text-slate-800 dark:text-slate-200 placeholder:italic border-none selection:bg-indigo-100 dark:selection:bg-indigo-900 mb-2 truncate bg-transparent"
              />
              <div className="h-px w-24 bg-indigo-200 group-focus-within:w-48 transition-all duration-500" />
            </div>
          </div>

          <div className="relative w-full">
            {editor && (
              <SelectionFloatingMenu editor={editor} onAiAction={runAiAction} customActions={customActions} />
            )}
            
            <EditorContent editor={editor} />

            {/* AI Progress overlay */}
            <AnimatePresence>
              {isAiProcessing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] rounded-lg"
                >
                  <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-xl">
                    <Loader2 size={16} className="animate-spin" />
                    Resonance Weaving...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Active Info Popup */}
            {activeInfoPopup && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-slate-200 border border-slate-700 rounded-2xl shadow-2xl p-5 w-[400px] max-w-full"
              >
                <div className="flex items-start justify-between mb-2 border-b border-slate-700/50 pb-2">
                  <div>
                    <h3 className="font-bold text-lg text-white font-serif">{activeInfoPopup.name}</h3>
                    <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">{activeInfoPopup.category}</span>
                  </div>
                  <button onClick={() => setActiveInfoPopup(null)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="text-sm leading-relaxed max-h-32 overflow-y-auto custom-scrollbar pr-2 mt-2 font-serif text-slate-300">
                  {activeInfoPopup.description}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Word Count / Info */}
        <div className="fixed bottom-0 left-0 right-0 h-12 border-t border-slate-200 dark:border-slate-800 bg-background/90 backdrop-blur-md px-6 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest z-10" style={{ right: (isAssistantOpen || isSnapshotsOpen || isTimelineOpen || isInsightsOpen) ? 340 : 0, transition: 'right 0.3s ease' }}>
          <div className="flex gap-4 items-center">
            <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 dark:text-slate-400">
              Kata: {editor?.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length || 0}
            </span>
            <span>Karakter: {editor?.state.doc.textContent.length || 0}</span>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex gap-1 items-center mr-2">
              <button
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={!editor?.can().undo()}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo size={16} />
              </button>
              <button
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={!editor?.can().redo()}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <Redo size={16} />
              </button>
            </div>
            <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-300", 
              saveStatus === 'Menyimpan...' ? 'text-amber-600 bg-amber-50' : 
              saveStatus === 'Tersimpan' ? 'text-emerald-600 bg-emerald-50 opacity-100' : 'opacity-0 text-emerald-600 bg-emerald-50'
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", saveStatus === 'Menyimpan...' ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
              {saveStatus || 'Tersimpan'}
            </span>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <button
              onClick={() => setIsTypewriterMode(!isTypewriterMode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors",
                isTypewriterMode ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
              title="Mode Mesin Tik (Kursor tetap di tengah)"
            >
              <Type size={14} />
              <span className="hidden sm:inline">Mesin Tik</span>
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <button 
              onClick={() => {
                setIsSnapshotsOpen(!isSnapshotsOpen);
                setIsAssistantOpen(false);
                setIsTimelineOpen(false);
                setIsInsightsOpen(false);
              }}
              className={cn(
                "p-2 rounded-full transition-all border",
                isSnapshotsOpen ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-100"
              )}
              title="Riwayat Versi"
            >
              <History size={16} />
            </button>
            <button 
              onClick={() => {
                setIsTimelineOpen(!isTimelineOpen);
                setIsAssistantOpen(false);
                setIsSnapshotsOpen(false);
                setIsInsightsOpen(false);
              }}
              className={cn(
                "p-2 rounded-full transition-all border",
                isTimelineOpen ? "bg-orange-50 border-orange-200 text-orange-700 shadow-sm" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-100"
              )}
              title="Alur Cerita"
            >
              <GripVertical size={16} />
            </button>
            <button 
              onClick={() => {
                setIsInsightsOpen(!isInsightsOpen);
                setIsAssistantOpen(false);
                setIsSnapshotsOpen(false);
                setIsTimelineOpen(false);
              }}
              className={cn(
                "p-2 rounded-full transition-all border",
                isInsightsOpen ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-100"
              )}
              title="Analisis Prosa"
            >
              <Gauge size={16} />
            </button>
            <button 
              onClick={() => {
                setIsAssistantOpen(!isAssistantOpen);
                setIsSnapshotsOpen(false);
                setIsTimelineOpen(false);
                setIsInsightsOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full transition-all border",
                isAssistantOpen ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-100"
              )}
            >
              <MessageSquareText size={14} />
              {isAssistantOpen ? 'Tutup Asisten' : 'Brainstorming AI'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-l border-slate-200 dark:border-slate-800 overflow-hidden relative"
          >
            <div className="w-[340px] h-full absolute top-0 right-0">
              <AIAssistantPanel 
                projectId={projectId} 
                currentText={editor?.getText() || ''} 
                onClose={() => setIsAssistantOpen(false)} 
                onInsertText={(text) => {
                  editor?.commands.insertContent('\n\n' + text);
                }}
              />
            </div>
          </motion.div>
        )}

        {isSnapshotsOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-l border-slate-200 dark:border-slate-800 overflow-hidden relative"
          >
            <div className="w-[340px] h-full absolute top-0 right-0">
              <SnapshotPanel 
                chapterId={chapterId} 
                currentContent={editor?.getHTML() || ''} 
                onRestore={(text) => {
                  editor?.commands.setContent(text);
                  db.chapters.update(chapterId, { content: text, lastModified: Date.now() });
                  setIsSnapshotsOpen(false);
                }} 
              />
            </div>
          </motion.div>
        )}

        {isTimelineOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-l border-slate-200 dark:border-slate-800 overflow-hidden relative"
          >
            <div className="w-[340px] h-full absolute top-0 right-0">
              <TimelinePanel chapterId={chapterId} projectId={projectId} />
            </div>
          </motion.div>
        )}

        {isInsightsOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-l border-slate-200 dark:border-slate-800 overflow-hidden relative"
          >
            <div className="w-[340px] h-full absolute top-0 right-0">
              <ProseInsights content={editor?.getText() || ''} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
