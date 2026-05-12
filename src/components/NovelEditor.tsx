/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Loader2, 
  MessageSquareText, 
  X, 
  ScrollText, 
  Type, 
  History,
  GripVertical,
  Gauge,
  Undo,
  Redo,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../AppContext';
import { getRelevantContext, getRelevantBibleRules } from '../services/contextEngine';
import { 
  processRewrite, 
  processChat, 
  cancelAI, 
  AIError, 
  extractToCodex, 
  expandCodexEntry 
} from '../services/ai';
import { cn } from '../lib/utils';
import { SelectionFloatingMenu } from './SelectionFloatingMenu';
import { CodexEntry } from '../types';
import { useEditorPanel, EditorPanelProvider } from '../EditorPanelContext';
import { useProjectData } from '../hooks/useProjectData';
import { PANEL_WIDTH } from '../lib/constants';
import { useToast } from '../hooks/useToast';

// Lazy load side panels
const AIAssistantPanel = React.lazy(() => import('./AIAssistantPanel').then(m => ({ default: m.AIAssistantPanel })));
const SnapshotPanel = React.lazy(() => import('./SnapshotPanel').then(m => ({ default: m.SnapshotPanel })));
const TimelinePanel = React.lazy(() => import('./TimelinePanel').then(m => ({ default: m.TimelinePanel })));
const ProseInsights = React.lazy(() => import('./ProseInsights').then(m => ({ default: m.ProseInsights })));

// Tiptap Imports
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TiptapHistory from '@tiptap/extension-history';
import { Extension, Editor } from '@tiptap/core';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';
import { PassiveCodexHighlight } from '../extensions/PassiveCodexHighlight';

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
}

/// Floating menu moved to SelectionFloatingMenu.tsx

interface NovelFooterProps {
  editor: Editor | null;
  saveStatus: string;
  isTypewriterMode: boolean;
  setIsTypewriterMode: (val: boolean) => void;
  isFocusMode?: boolean;
  setIsFocusMode: (val: boolean) => void;
}

function NovelFooter({ editor, saveStatus, isTypewriterMode, setIsTypewriterMode, isFocusMode, setIsFocusMode }: NovelFooterProps) {
  const { activePanel, setActivePanel } = useEditorPanel();
  const togglePanel = (panel: any) => {
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  return (
    <div className="h-12 border-t border-slate-200 dark:border-slate-800 bg-background/90 backdrop-blur-md px-6 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest z-10 transition-colors">
      {/* Left: Stats */}
      <div className="flex gap-4 items-center">
        <span className="bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
          KATA: {editor?.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length || 0}
        </span>
        <span className="hidden sm:inline">KARAKTER: {editor?.state.doc.textContent.length || 0}</span>
      </div>

      {/* Middle: Save Status */}
      <div className="flex items-center justify-center">
        <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-300 border border-transparent", 
          saveStatus === 'Menyimpan...' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/20' : 
          saveStatus === 'Tersimpan' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/20 opacity-100' : 'opacity-0'
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", saveStatus === 'Menyimpan...' ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
          {saveStatus || 'Tersimpan'}
        </span>
      </div>

      {/* Right: Controls & Toggles */}
      <div className="flex gap-2 items-center">
        {/* Sync Indicator */}
        <div className="flex items-center justify-center p-1.5 mr-1" title="SINKRONISASI AKTIF">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse outline outline-2 outline-emerald-500/10"></div>
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

        {/* Editor Actions */}
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={cn(
              "p-1.5 rounded text-slate-500 hover:text-indigo-600 transition-colors",
              isFocusMode ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Focus Mode (Ctrl+Alt+F)"
          >
            <Zap size={14} />
          </button>
          
          <button
            aria-label="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={14} />
          </button>
          <button
            aria-label="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>

        {/* Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsTypewriterMode(!isTypewriterMode)}
            className={cn(
              "p-1.5 rounded transition-colors group relative",
              isTypewriterMode ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Mode Mesin Tik"
          >
            <Type size={14} />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>

          <button 
            onClick={() => togglePanel('snapshots')}
            className={cn(
              "p-1.5 rounded transition-all",
              activePanel === 'snapshots' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Riwayat Versi"
          >
            <History size={16} />
          </button>
          <button 
            onClick={() => togglePanel('timeline')}
            className={cn(
              "p-1.5 rounded transition-all",
              activePanel === 'timeline' ? "bg-orange-50 dark:bg-orange-900/10 text-orange-700 shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Alur Cerita"
          >
            <GripVertical size={16} />
          </button>
          <button 
            onClick={() => togglePanel('insights')}
            className={cn(
              "p-1.5 rounded transition-all",
              activePanel === 'insights' ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Analisis Prosa"
          >
            <Gauge size={16} />
          </button>
          
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>

          <button 
            onClick={() => togglePanel('assistant')}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full transition-all border",
              activePanel === 'assistant' 
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-100"
            )}
            title="Asisten AI"
          >
            <MessageSquareText size={14} />
            <span className="hidden lg:inline">Asisten AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface NovelPanelsProps {
  projectId: number;
  chapterId: number;
  editor: Editor | null;
  codexEntries: any[];
  bibleRules: any[];
}

function NovelPanels({ projectId, chapterId, editor, codexEntries, bibleRules }: NovelPanelsProps) {
  const { activePanel, setActivePanel } = useEditorPanel();
  return (
    <AnimatePresence>
      <React.Suspense fallback={
        <div className="h-full border-l border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50/50" style={{ width: activePanel !== 'none' ? PANEL_WIDTH : 0 }}>
          {activePanel !== 'none' && <Loader2 className="animate-spin text-slate-300" size={24} />}
        </div>
      }>
        {activePanel !== 'none' && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <div className="h-full flex flex-col" style={{ width: PANEL_WIDTH }}>
              {activePanel === 'assistant' && (
                <AIAssistantPanel 
                  projectId={projectId} 
                  currentText={editor?.getText() || ''} 
                  onClose={() => setActivePanel('none')} 
                  onInsertText={(text) => {
                    editor?.commands.insertContent('\n\n' + text);
                  }}
                  codexEntries={codexEntries}
                  bibleRules={bibleRules}
                />
              )}

              {activePanel === 'snapshots' && (
                <SnapshotPanel 
                  chapterId={chapterId} 
                  currentContent={editor?.getHTML() || ''} 
                  onRestore={(text) => {
                    editor?.commands.setContent(text);
                    db.chapters.update(chapterId, { content: text, lastModified: Date.now() });
                    setActivePanel('none');
                  }} 
                />
              )}

              {activePanel === 'timeline' && (
                <TimelinePanel chapterId={chapterId} projectId={projectId} />
              )}

              {activePanel === 'insights' && (
                <ProseInsights content={editor?.getText() || ''} />
              )}
            </div>
          </motion.div>
        )}
      </React.Suspense>
    </AnimatePresence>
  );
}

export function NovelEditor(props: NovelEditorProps) {
  return (
    <EditorPanelProvider>
      <NovelEditorInner {...props} />
    </EditorPanelProvider>
  );
}

function NovelEditorInner({ chapterId, projectId }: NovelEditorProps) {
  const chapter = useLiveQuery(() => db.chapters.get(chapterId), [chapterId]);
  const [title, setTitle] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const { toast } = useToast();

  const { isFocusMode, setIsFocusMode } = useAppContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { codexEntries, aiActions, bibleRules, isLoading } = useProjectData(projectId);

  // Tiptap Editor Initialization
  const codexEntriesRef = useRef<CodexEntry[]>([]);
  
  const [activeCodexPopup, setActiveCodexPopup] = useState<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      cancelAI('rewrite');
    };
  }, []);

  const chapterIdRef = useRef(chapterId);
  useEffect(() => {
    chapterIdRef.current = chapterId;
  }, [chapterId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      TiptapHistory,
      CustomAIKeymap,
      PassiveCodexHighlight.configure({
        getCodexEntries: () => codexEntriesRef.current,
        onCodexClick: (entryId, event) => {
          setActiveCodexPopup({
            id: entryId,
            x: event.clientX,
            y: event.clientY,
          });
        }
      }),
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
            let component: ReactRenderer;
            let popup: any;

            return {
              onStart: props => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }

                return (component.ref as any)?.onKeyDown(props);
              },
              onExit() {
                popup[0].destroy();
                component.destroy();
              },
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
        db.chapters.update(chapterIdRef.current, { content: html, lastModified: Date.now() }).then(() => {
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

  useEffect(() => {
    codexEntriesRef.current = codexEntries || [];
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta('updateCodexHighlights', true));
    }
  }, [codexEntries, editor]);

  const [saveStatus, setSaveStatus] = useState('');

  // Is Typewriter mode toggle affect classes dynamically
  useEffect(() => {
    if (editor) {
      if (isTypewriterMode) {
        editor.view.dom.style.paddingTop = '40vh';
        editor.view.dom.style.paddingBottom = '40vh';
      } else {
        editor.view.dom.style.paddingTop = '0';
        editor.view.dom.style.paddingBottom = '48px';
      }
    }
  }, [editor, isTypewriterMode]);

  // Load chapter data manually when ID changes to avoid full reconstruction
  useEffect(() => {
    if (chapter && editor) {
      if (editor.getHTML() !== chapter.content) {
        // preserve history if jumping between chapters? actually we probably want to clear history, but since we don't use full history extension cross-session, just set content.
        editor.commands.setContent(chapter.content);
        if ((editor.commands as any).clearHistory) {
          (editor.commands as any).clearHistory();
        }
      }
      if (title !== chapter.title) {
         setTitle(chapter.title);
      }
    }
  }, [chapter?.id, editor]); // intentionally omitted chapter.title so it doesn't revert user typings

  // Handle auto-scroll for typewriter mode and popup close
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      setActiveCodexPopup(null); // Close popup when typing or selecting
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

  if (chapter === undefined || isLoading) {
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

  const runAiAction = async (action: string, provider?: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (selectedText.length < 5) return;

    setIsAiProcessing(true);
    try {
      const relevantCodex = getRelevantContext(selectedText, codexEntries || []);
      const relevantBible = getRelevantBibleRules(selectedText, bibleRules || []);

      const result = await processRewrite({
        action,
        selection: selectedText,
        bibleRules: relevantBible,
        codexEntries: relevantCodex,
        prompt: '',
        provider
      });

      editor.commands.insertContentAt({ from, to }, result);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'AI Rewrite failed. Please try again.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="flex h-full relative overflow-hidden bg-white dark:bg-slate-900">
      {/* Main Editing Column */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Scrollable Content Area */}
        <div 
          ref={containerRef} 
          className="flex-1 relative overflow-y-auto scroll-smooth custom-scrollbar pb-16"
        >
          {/* Editor Surface */}
          <div className={cn(
            "w-full max-w-2xl mx-auto flex flex-col min-h-full px-8 sm:px-0 transition-all duration-700",
            isFocusMode && "max-w-xl"
          )}>
            {/* Header: Title */}
            <div className="pt-8 pb-4 mb-4 border-b border-transparent group-focus-within:border-slate-100 dark:group-focus-within:border-slate-800 transition-all">
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
                <SelectionFloatingMenu editor={editor} onAiAction={runAiAction} customActions={aiActions} />
              )}
              
              <AnimatePresence>
                {activeCodexPopup && (() => {
                  const entry = codexEntries?.find(e => e.id === activeCodexPopup.id);
                  if (!entry) return null;
                  const POPUP_HEIGHT = 180;
                  const rawY = activeCodexPopup.y + 15;
                  const safeY = rawY + POPUP_HEIGHT > window.innerHeight
                    ? activeCodexPopup.y - POPUP_HEIGHT - 10
                    : rawY;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="fixed z-[100] bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-2xl w-64 text-sm pointer-events-auto"
                      style={{ left: Math.min(activeCodexPopup.x + 10, window.innerWidth - 280), top: safeY }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-indigo-400 uppercase text-[10px] tracking-widest">{entry.category}</span>
                        <button onClick={() => setActiveCodexPopup(null)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full p-0.5"><X size={12} /></button>
                      </div>
                      <h4 className="font-bold text-base mb-1 text-slate-100">{entry.name}</h4>
                      <p className="font-serif italic text-slate-300 text-xs leading-relaxed line-clamp-4">{entry.description || 'No description available.'}</p>
                      {entry.aliases && entry.aliases.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 w-full mb-1">Aliases</span>
                          {entry.aliases.map(a => <span key={a} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{a}</span>)}
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              <EditorContent editor={editor} />

              {/* AI Progress overlay */}
              <AnimatePresence>
                {isAiProcessing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-panel flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] rounded-lg"
                  >
                    <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-xl">
                      <Loader2 size={16} className="animate-spin" />
                      Resonance Weaving...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Status Bar / Footer (Now pushed by side panels automatically) */}
        <NovelFooter 
          editor={editor} 
          saveStatus={saveStatus} 
          isTypewriterMode={isTypewriterMode} 
          setIsTypewriterMode={setIsTypewriterMode} 
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
        />
      </div>

      {/* Right Panels Column */}
      <NovelPanels 
        projectId={projectId} 
        chapterId={chapterId} 
        editor={editor} 
        codexEntries={codexEntries} 
        bibleRules={bibleRules} 
      />
    </div>
  );
}
