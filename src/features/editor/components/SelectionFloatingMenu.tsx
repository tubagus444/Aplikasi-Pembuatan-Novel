import React, { useState, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Sparkles, 
  Check, 
  X, 
  CornerDownRight, 
  Send, 
  Info, 
  ArrowLeft, 
  Wand2,
  Loader2,
  Eye,
  Flame,
  Pin,
  PinOff,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Editor } from '@tiptap/react';
import { AIAction } from '@/src/types';
import { useAvailableProviders } from '@/src/hooks/useAvailableProviders';

interface SelectionFloatingMenuProps {
  editor: Editor;
  onAiAction: (action: string, provider?: string, customPrompt?: string) => void;
  customActions?: AIAction[];
  isAiProcessing?: boolean;
  rewritePreview?: { original: string; rewritten: string; from: number; to: number } | null;
  setRewritePreview?: (preview: any | null) => void;
  onAcceptRewrite?: () => void;
  onInsertBelow?: () => void;
  onDiscardRewrite?: () => void;
}

export function SelectionFloatingMenu({ 
  editor, 
  onAiAction, 
  customActions = [],
  isAiProcessing = false,
  rewritePreview = null,
  setRewritePreview,
  onAcceptRewrite,
  onInsertBelow,
  onDiscardRewrite
}: SelectionFloatingMenuProps) {
  const [show, setShow] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('');
  const { 
    availableProviders, 
    selectedProvider, 
    setSelectedProvider 
  } = useAvailableProviders();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  // Load docked state from localStorage
  const [isDocked, setIsDocked] = useState(() => {
    try {
      return localStorage.getItem('novel-editor-floating-menu-docked') === 'true';
    } catch {
      return false;
    }
  });

  // Keep menu collapsed in a small bubble to avoid blockages
  const [isMini, setIsMini] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('novel-editor-floating-menu-docked', String(isDocked));
    } catch (e) {
      console.warn(e);
    }
  }, [isDocked]);

  const showRef = React.useRef(show);

  useEffect(() => {
    showRef.current = show;
  }, [show]);

  const selectionTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleSelection = React.useCallback(() => {
    const { selection } = editor.state;
    
    // Check if empty selection
    if (selection.empty) {
      // Keep showing menu if we are in active preview mode, so user can read/decide
      if (rewritePreview) return;
      
      setShow(false);
      setSelectedText('');
      setIsCustomOpen(false);
      setIsMini(false); // Reset mini on selection clear
      return;
    }

    const rawText = editor.state.doc.textBetween(selection.from, selection.to, ' ');
    setSelectedText(rawText);

    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);

    // Small timeout to allow DOM to paint the selection rect
    selectionTimerRef.current = setTimeout(() => {
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Only show if the selection actually has dimensions
        if (rect.width > 0 && rect.height > 0) {
          const showAtBottom = rect.top < 140;
          setPlacement(showAtBottom ? 'bottom' : 'top');
          
          setPosition({
            // Generous spacing (18px) prevents the menu from overlapping with selected lines
            top: showAtBottom ? rect.bottom + 18 : rect.top - 18,
            // Math.max/min guarantees the menu remains fully visible on screens
            left: Math.max(220, Math.min(window.innerWidth - 220, rect.left + (rect.width / 2)))
          });
          setShow(true);
        } else {
          if (!rewritePreview) setShow(false);
        }
      }
    }, 0);
  }, [editor, rewritePreview]);

  useEffect(() => {
    return () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    editor.on('selectionUpdate', handleSelection);
    
    const handleScrollOrResize = () => {
      if (showRef.current) handleSelection();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      editor.off('selectionUpdate', handleSelection);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [editor, handleSelection]);

  // Clean-up custom view when floating menu hides
  useEffect(() => {
    if (!show) {
      setIsCustomOpen(false);
      setCustomPromptText('');
    }
  }, [show]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPromptText.trim() || isAiProcessing) return;
    onAiAction('Custom prompt', selectedProvider, customPromptText);
    setIsCustomOpen(false);
  };


  const hasLengthWarning = selectedText.trim().length < 5;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={cn(
            "fixed z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border transition-colors duration-200",
            rewritePreview 
              ? "rounded-2xl p-4 w-[480px] max-w-[90vw] border-slate-200 dark:border-slate-800"
              : isMini
                ? "rounded-full p-1 border-indigo-200 dark:border-indigo-800/80 ring-2 ring-indigo-500/20"
                : "rounded-full p-1 border-slate-200/50 dark:border-slate-700/50"
          )}
          style={isDocked ? { 
            position: 'fixed',
            bottom: '24px', 
            left: '50%', 
            transform: 'translateX(-50%)',
            top: 'auto'
          } : { 
            top: position.top, 
            left: position.left, 
            transform: placement === 'bottom' ? 'translateX(-50%)' : 'translateX(-50%) translateY(-100%)' 
          }}
          id="selection-floating-menu"
        >
          {isMini && !rewritePreview ? (
            /* --- COLLAPSED MINI TRIGGER STATE --- */
            <div className="flex items-center p-0.5" id="mini-container">
              <button
                type="button"
                onClick={() => setIsMini(false)}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                title="Buka Menu AI (Bantu Menulis)"
              >
                <Sparkles size={11} className="animate-pulse text-indigo-200 whitespace-nowrap" />
                <span className="whitespace-nowrap">Asisten Menulis AI</span>
              </button>
            </div>
          ) : rewritePreview ? (
            /* --- REWRITE COMPARISON / PREVIEW STATE --- */
            <div className="flex flex-col gap-3 text-slate-800 dark:text-slate-100" id="preview-container">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-indigo-500 dark:text-indigo-400">
                  <Sparkles size={13} className="text-indigo-500 animate-pulse" />
                  Pratinjau Hasil Tenun AI
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsDocked(!isDocked)}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      isDocked 
                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                    title={isDocked ? "Beralih ke Melayang (Float)" : "Sematkan di Bawah Layar agar Tidak Menghalangi (Dock to Bottom)"}
                  >
                    {isDocked ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button 
                    type="button"
                    onClick={onDiscardRewrite}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Batalkan"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto no-scrollbar">
                {/* Before (Original) */}
                <div className="p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 flex flex-col gap-1.5 select-none">
                  <span className="text-[9px] font-bold tracking-wide uppercase text-amber-600 dark:text-amber-500">
                    Naskah Asli
                  </span>
                  <p className="font-serif italic text-xs text-slate-500 line-clamp-6 leading-relaxed">
                    "{rewritePreview.original}"
                  </p>
                </div>

                {/* After (Rewritten) */}
                <div className="p-2.5 rounded-lg border border-emerald-200/50 dark:border-emerald-950/30 bg-emerald-50/20 dark:bg-emerald-950/10 flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    Hasil Tenunan
                  </span>
                  <p className="font-serif text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-[160px] overflow-y-auto">
                    {rewritePreview.rewritten}
                  </p>
                </div>
              </div>

              {/* Action Buttons row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  onClick={onDiscardRewrite}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <X size={13} />
                  Abaikan
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={onInsertBelow}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5"
                    title="Sisipkan teks baru di bawah teks terpilih"
                  >
                    <CornerDownRight size={13} className="text-slate-500" />
                    Sisipkan di Bawah
                  </button>
                  <button
                    onClick={onAcceptRewrite}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center gap-1.5"
                    title="Timpa teks terpilih dengan hasil baru"
                  >
                    <Check size={13} />
                    Ganti Teks
                  </button>
                </div>
              </div>
            </div>
          ) : isAiProcessing ? (
            /* --- ACTIVE PROCESSING LOADING STATE --- */
            <div className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[200px]" id="loading-container">
              <Loader2 size={14} className="animate-spin text-indigo-500" />
              <span className="font-serif italic animate-pulse">Menenun prosa indah...</span>
            </div>
          ) : isCustomOpen ? (
            /* --- CUSTOM PROMPT TEXT INPUT MODE --- */
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 px-1 py-0.5 min-w-[320px] max-w-lg md:min-w-[400px]" id="custom-prompt-form">
              <button
                type="button"
                onClick={() => setIsCustomOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full transition-colors shrink-0"
              >
                <ArrowLeft size={14} />
              </button>
              
              <input
                autoFocus
                type="text"
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                placeholder="Tulis instruksi khusus (misal: buat lebih sedih, puitis)..."
                className="flex-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-xs px-1 py-1 text-slate-800 dark:text-slate-100"
              />

              <button
                type="submit"
                disabled={!customPromptText.trim()}
                className={cn(
                  "p-1.5 rounded-full shrink-0 transition-all",
                  customPromptText.trim() 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                    : "text-slate-300 dark:text-slate-700 pointer-events-none"
                )}
                title="Tenun Gaya Kustom"
              >
                <Send size={12} />
              </button>
            </form>
          ) : (
            /* --- DEFAULT OPTION SELECTION PILLS --- */
            <div className="flex flex-nowrap items-center gap-0.5" id="floating-menu-options">
              {/* Optional Multi-provider indicators */}
              {availableProviders.length > 1 && (
                <div className="flex gap-1 px-1.5 border-r border-slate-200 dark:border-slate-800 mr-0.5">
                  {availableProviders.map(p => (
                    <button
                      key={p}
                      onClick={() => setSelectedProvider(p)}
                      title={`Gunakan provider ${p}`}
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all uppercase",
                        selectedProvider === p 
                          ? "ring-2 ring-offset-2 dark:ring-offset-slate-900 ring-indigo-500 bg-indigo-600 text-white" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                      )}
                    >
                      {p[0]}
                    </button>
                  ))}
                </div>
              )}

              {/* Text formatting controls */}
              <div className="flex px-1 gap-0.5 shrink-0">
                <button 
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn(
                    "p-1.5 rounded-full transition-colors", 
                    editor.isActive('bold') 
                      ? "text-indigo-600 dark:text-indigo-400 bg-slate-100/90 dark:bg-slate-800/90 font-bold" 
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  )}
                  title="Tebalkan (Bold)"
                >
                  <Bold size={13} />
                </button>
                <button 
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn(
                    "p-1.5 rounded-full transition-colors", 
                    editor.isActive('italic') 
                      ? "text-indigo-600 dark:text-indigo-400 bg-slate-100/90 dark:bg-slate-800/90 italic" 
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  )}
                  title="Miringkan (Italic)"
                >
                  <Italic size={13} />
                </button>
              </div>

              {/* Behavior & Docking Controls */}
              <div className="flex px-1 gap-0.5 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-1 ml-0.5">
                <button
                  type="button"
                  onClick={() => setIsDocked(!isDocked)}
                  className={cn(
                    "p-1.5 rounded-full transition-all",
                    isDocked 
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  )}
                  title={isDocked ? "Beralih ke Melayang (Float)" : "Sematkan di Bawah Layar agar Tidak Menghalangi (Dock to Bottom)"}
                >
                  {isDocked ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMini(true)}
                  className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all"
                  title="Sembunyikan menu/Kecilkan (Minimize)"
                >
                  <Minimize2 size={13} />
                </button>
              </div>
              
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />
              
              {/* AI action pills */}
              <div className="flex items-center gap-0.5 px-1 overflow-x-auto no-scrollbar max-w-[320px] md:max-w-[425px]">
                {hasLengthWarning ? (
                  /* Muted state warning to explain constraint clearly */
                  <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0 select-none">
                    <Info size={11} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    Pilih min. 5 karakter untuk opsi AI
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => onAiAction("Show don't tell", selectedProvider)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-full transition-colors flex items-center gap-1.5 shrink-0"
                      title="Ubah kalimat deskriptif pasif agar langsung memperlihatkan aksinya"
                    >
                      <Sparkles size={11} className="text-indigo-500 animate-pulse shrink-0" />
                      Show, don't tell
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => onAiAction("Focus Senses", selectedProvider)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-full transition-colors flex items-center gap-1 shrink-0"
                      title="Perkaya deskripsi suasana dengan melibatkan pancaindra"
                    >
                      <Eye size={11} className="text-slate-400 dark:text-indigo-400 shrink-0" />
                      Senses
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => onAiAction("Intensify", selectedProvider)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-full transition-colors flex items-center gap-1 shrink-0"
                      title="Tingkatkan ketegangan dramatis atau emosional fragmen teks"
                    >
                      <Flame size={11} className="text-slate-400 dark:text-indigo-400 shrink-0" />
                      Intensify
                    </button>

                    {customActions?.map((action) => (
                      <button 
                        key={action.id || action.prompt}
                        onClick={() => onAiAction(action.prompt, selectedProvider)} 
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-full transition-colors shrink-0"
                      >
                        {action.label}
                      </button>
                    ))}
                    
                    <button 
                      type="button"
                      onClick={() => setIsCustomOpen(true)}
                      className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 rounded-full transition-colors flex items-center gap-1 shrink-0"
                      title="Gunakan perintah kustom buatan Anda"
                    >
                      <Wand2 size={11} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                      Lainnya...
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
