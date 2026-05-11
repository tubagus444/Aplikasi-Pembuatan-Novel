import React, { useState, useEffect } from 'react';
import { Bold, Italic, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Editor } from '@tiptap/react';
import { AIAction } from '../types';

interface SelectionFloatingMenuProps {
  editor: Editor;
  onAiAction: (action: string) => void;
  customActions?: AIAction[];
}

export function SelectionFloatingMenu({ editor, onAiAction, customActions = [] }: SelectionFloatingMenuProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const showRef = React.useRef(show);

  useEffect(() => {
    showRef.current = show;
  }, [show]);

  const selectionTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleSelection = React.useCallback(() => {
    const { selection } = editor.state;
    if (selection.empty) {
      setShow(false);
      return;
    }

    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);

    // Small timeout to allow DOM to paint the selection rect
    selectionTimerRef.current = setTimeout(() => {
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Only show if the selection actually has dimensions
        if (rect.width > 0 && rect.height > 0) {
          setPosition({
            top: rect.top - 8, // 8px above the top of the selection
            left: rect.left + (rect.width / 2) // Centered over selection
          });
          setShow(true);
        } else {
          setShow(false);
        }
      }
    }, 0);
  }, [editor]);

  useEffect(() => {
    return () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    editor.on('selectionUpdate', handleSelection);
    
    // Update position on scroll/resize
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

  return (
    <AnimatePresence>
      {show && (
        <motion.div
           initial={{ opacity: 0, y: 10, scale: 0.95 }}
           animate={{ opacity: 1, y: 0, scale: 1 }}
           exit={{ opacity: 0, y: 10, scale: 0.95 }}
           transition={{ duration: 0.15, ease: "easeOut" }}
           className="fixed z-[100] flex flex-nowrap bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-xl rounded-full p-1 gap-0.5 items-center transform -translate-x-1/2 -translate-y-full"
           style={{ top: position.top, left: position.left, maxWidth: '90vw' }}
         >
           <div className="flex px-1 gap-0.5">
             <button 
               onClick={() => editor.chain().focus().toggleBold().run()}
               className={cn("p-1.5 rounded-full transition-colors", editor.isActive('bold') ? "text-indigo-600 dark:text-indigo-400 bg-slate-100/80 dark:bg-slate-800/80" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50")}
               title="Bold"
             >
               <Bold size={14} />
             </button>
             <button 
               onClick={() => editor.chain().focus().toggleItalic().run()}
               className={cn("p-1.5 rounded-full transition-colors", editor.isActive('italic') ? "text-indigo-600 dark:text-indigo-400 bg-slate-100/80 dark:bg-slate-800/80" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50")}
               title="Italic"
             >
               <Italic size={14} />
             </button>
           </div>
           
           <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
           
           <div className="flex items-center gap-0.5 px-1 overflow-x-auto no-scrollbar mask-edges">
             <button 
               onClick={() => onAiAction("Show don't tell")}
               className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-full transition-colors flex items-center gap-1.5 shrink-0"
             >
               <Sparkles size={12} className="text-indigo-500 dark:text-indigo-400" />
               Show, don't tell
             </button>
             <button 
               onClick={() => onAiAction("Focus Senses")}
               className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-full transition-colors shrink-0"
             >
               Senses
             </button>
             <button 
               onClick={() => onAiAction("Intensify")}
               className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-full transition-colors shrink-0"
             >
               Intensify
             </button>
             {customActions?.map((action) => (
               <button 
                 key={action.id}
                 onClick={() => onAiAction(action.prompt)} 
                 className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-full transition-colors shrink-0"
               >
                 {action.label}
               </button>
             ))}
           </div>
         </motion.div>
      )}
    </AnimatePresence>
  );
}
