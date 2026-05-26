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
  Maximize2,
  Search
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
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const showAiMenuRef = React.useRef(showAiMenu);
  const isCustomOpenRef = React.useRef(isCustomOpen);

  useEffect(() => {
    showAiMenuRef.current = showAiMenu;
  }, [showAiMenu]);

  useEffect(() => {
    isCustomOpenRef.current = isCustomOpen;
  }, [isCustomOpen]);

  const handleSelection = React.useCallback(() => {
    const { selection } = editor.state;
    
    // Check if empty selection
    if (selection.empty) {
      // Keep showing menu if we are in active preview mode, or interacting with Ai menu
      if (rewritePreview || showAiMenuRef.current || isCustomOpenRef.current) return;
      
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
        // If we are actively using the AI menu or custom input, don't auto-close or reposition based on DOM selection
        // Because DOM selection might be inside the menu's input fields
        if ((showAiMenuRef.current || isCustomOpenRef.current) && showRef.current) {
          return;
        }

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
          if (!rewritePreview && !showAiMenuRef.current && !isCustomOpenRef.current) {
            setShow(false);
          }
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
    
    const handleScrollOrResize = (e: Event) => {
      if (e && e.type === 'scroll') {
        const target = e.target as HTMLElement;
        if (target && target.closest && target.closest('#selection-floating-menu')) {
          // Ignore scroll events originating from inside the floating menu itself
          return;
        }
      }
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
      setShowAiMenu(false);
      setSearchQuery('');
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

  const builtInActions = [
    { id: "Show don't tell", label: "Show, don't tell", icon: Sparkles, desc: "Ubah kalimat deskriptif pasif" },
    { id: "Focus Senses", label: "Senses", icon: Eye, desc: "Perkaya deskripsi suasana" },
    { id: "Intensify", label: "Intensify", icon: Flame, desc: "Tingkatkan ketegangan dramatis" }
  ];

  const filteredBuiltIn = builtInActions.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCustom = customActions.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={cn(
            "fixed z-[100] transition-colors duration-200 flex",
            placement === 'top' ? "flex-col-reverse items-center" : "flex-col items-center",
            (rewritePreview || isMini || isAiProcessing) ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border max-w-[95vw]" : "",
            rewritePreview 
              ? "rounded-2xl p-4 w-[480px] border-slate-200 dark:border-slate-800"
              : isMini
                ? "rounded-full p-1 border-indigo-200 dark:border-indigo-800/80 ring-2 ring-indigo-500/20"
                : isAiProcessing
                  ? "rounded-full p-2 border-slate-200/50 dark:border-slate-700/50"
                  : ""
          )}
          style={isDocked ? { 
            position: 'fixed',
            bottom: '72px', 
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
          ) : (
            /* --- DEFAULT MULTI-LAYERED MENU --- */
            <>
              {/* LAYER 1: Core Actions Pill */}
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 p-1.5 rounded-full flex items-center gap-1 shadow-xl">
                {/* Formatting */}
                <div className="flex gap-0.5 px-0.5 shrink-0">
                  <button 
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(
                      "p-1.5 rounded-full transition-colors flex items-center justify-center", 
                      editor.isActive('bold') 
                        ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    )}
                    title="Tebalkan (Bold)"
                  >
                    <Bold size={14} />
                  </button>
                  <button 
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(
                      "p-1.5 rounded-full transition-colors flex items-center justify-center", 
                      editor.isActive('italic') 
                        ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 italic" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    )}
                    title="Miringkan (Italic)"
                  >
                    <Italic size={14} />
                  </button>
                </div>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0" />

                {/* AI Trigger */}
                <button
                  type="button"
                  onClick={() => setShowAiMenu(!showAiMenu)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs rounded-full transition-all shrink-0",
                    showAiMenu 
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                      : "bg-indigo-50 hover:bg-indigo-100/70 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  )}
                  title="Buka menu Asisten AI"
                >
                  <Sparkles size={13} className={cn(showAiMenu ? "text-indigo-700 dark:text-indigo-300" : "animate-pulse")} />
                  Tanya AI
                  {hasLengthWarning && <Info size={12} className="text-indigo-400 dark:text-indigo-500 ml-0.5" />}
                </button>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0" />

                {/* Dock/Min Controls */}
                <div className="flex gap-0.5 px-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsDocked(!isDocked)}
                    className={cn(
                      "p-1.5 rounded-full transition-all flex items-center justify-center",
                      isDocked 
                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    )}
                    title={isDocked ? "Beralih ke Melayang (Float)" : "Sematkan di Bawah Layar agar Tidak Menghalangi (Dock to Bottom)"}
                  >
                    {isDocked ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMini(true)}
                    className="p-1.5 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all"
                    title="Sembunyikan menu/Kecilkan (Minimize)"
                  >
                    <Minimize2 size={14} />
                  </button>
                </div>
              </div>

              {/* LAYER 2: AI Menu Overlay */}
              <AnimatePresence>
                {showAiMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 10 : -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 10 : -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn(
                      "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl flex flex-col w-[340px] max-w-[95vw] overflow-hidden",
                      placement === 'bottom' ? "mt-2" : "mb-2"
                    )}
                  >
                    {/* Header + Multi-provider indicator */}
                    <div className="flex items-center justify-between p-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                       <div className="flex items-center gap-2">
                         <Wand2 size={14} className="text-indigo-500 shrink-0" />
                         <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Asisten Editor AI</span>
                       </div>
                       
                       {availableProviders.length > 1 && (
                        <div className="flex gap-1 bg-slate-200/50 dark:bg-slate-800 min-w-min p-0.5 rounded-full">
                          {availableProviders.map(p => (
                            <button
                              key={p}
                              onClick={() => setSelectedProvider(p)}
                              title={`Gunakan provider ${p}`}
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all uppercase",
                                selectedProvider === p 
                                  ? "bg-indigo-600 text-white shadow-sm" 
                                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                              )}
                            >
                              {p[0]}
                            </button>
                          ))}
                        </div>
                       )}
                    </div>

                    {!hasLengthWarning ? (
                      <div className="flex flex-col max-h-[300px]">
                        {/* Custom Instruction Box */}
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800/80">
                          <form onSubmit={handleCustomSubmit} className="relative flex items-center">
                            <input
                              autoFocus
                              type="text"
                              value={customPromptText}
                              onChange={(e) => setCustomPromptText(e.target.value)}
                              placeholder="Ketik instruksi khusus (misal: buat lebih puitis)..."
                              className="w-full bg-slate-100 dark:bg-slate-800/80 border-0 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs px-3 py-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pr-9 transition-all"
                            />
                            <button
                              type="submit"
                              disabled={!customPromptText.trim()}
                              className={cn(
                                "absolute right-1 p-1.5 rounded-md shrink-0 transition-colors",
                                customPromptText.trim() 
                                  ? "text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-slate-700"
                                  : "text-slate-300 dark:text-slate-600 pointer-events-none"
                              )}
                              title="Tenun Gaya Kustom"
                            >
                              <Send size={14} />
                            </button>
                          </form>

                          {/* Action Search Bar */}
                          <div className="relative mt-2">
                             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                             <input
                               type="text"
                               value={searchQuery}
                               onChange={(e) => setSearchQuery(e.target.value)}
                               placeholder="Cari aksi (cth: Senses, Intensify)..."
                               className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded text-[11px] px-7 py-1.5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
                             />
                          </div>
                        </div>

                        {/* Action Categories */}
                        <div className="overflow-y-auto w-full flex-1 p-2 no-scrollbar space-y-3">
                           {filteredBuiltIn.length > 0 && (
                             <div>
                                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                                   Built-in
                                </div>
                                <div className="flex flex-col gap-0.5">
                                   {filteredBuiltIn.map((action) => (
                                     <button
                                        key={action.id}
                                        onClick={() => onAiAction(action.id, selectedProvider)}
                                        className="w-full text-left flex items-center gap-2.5 px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors group"
                                     >
                                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-1.5 rounded-md text-indigo-500 dark:text-indigo-400">
                                           <action.icon size={13} />
                                        </div>
                                        <div className="flex flex-col">
                                           <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{action.label}</span>
                                           <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{action.desc}</span>
                                        </div>
                                     </button>
                                   ))}
                                </div>
                             </div>
                           )}

                           {filteredCustom.length > 0 && (
                             <div>
                                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1 mt-1 flex items-center gap-1.5">
                                   Kustom (Personal)
                                </div>
                                <div className="flex flex-wrap gap-1.5 px-2">
                                  {filteredCustom.map((action) => (
                                    <button 
                                      key={action.id || action.prompt}
                                      onClick={() => onAiAction(action.prompt, selectedProvider)} 
                                      className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0 max-w-full truncate"
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                             </div>
                           )}

                           {filteredBuiltIn.length === 0 && filteredCustom.length === 0 && (
                             <div className="py-6 text-center text-xs text-slate-400">
                               Aksi tidak ditemukan.
                             </div>
                           )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 px-4 gap-2 text-center">
                        <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center">
                           <Info size={20} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Terlalu Singkat</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Pilih blok teks minimal 5 karakter untuk menggunakan asisten revisi dan gaya penulisan.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
