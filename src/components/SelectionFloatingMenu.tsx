import React, { useState, useEffect } from 'react';
import { Bold, Italic, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Editor } from '@tiptap/react';

interface SelectionFloatingMenuProps {
  editor: Editor;
  onAiAction: (action: string) => void;
  customActions?: any[];
}

export function SelectionFloatingMenu({ editor, onAiAction, customActions = [] }: SelectionFloatingMenuProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleSelection = () => {
      const { selection } = editor.state;
      setShow(!selection.empty);
    };

    editor.on('selectionUpdate', handleSelection);

    return () => {
      editor.off('selectionUpdate', handleSelection);
    };
  }, [editor]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
           initial={{ opacity: 0, y: 30, x: '-50%' }}
           animate={{ opacity: 1, y: 0, x: '-50%' }}
           exit={{ opacity: 0, y: 30, x: '-50%' }}
           className="fixed bottom-10 left-1/2 z-[100] flex flex-wrap bg-slate-900/95 backdrop-blur-sm border border-slate-700 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-full p-2 gap-2 items-center"
         >
           <div className="flex border-r border-slate-700 px-2 mr-1 gap-1">
             <button 
               onClick={() => editor.chain().focus().toggleBold().run()}
               className={cn("p-1.5 rounded-full hover:bg-slate-700 transition-colors", editor.isActive('bold') ? "text-indigo-400 bg-slate-800" : "text-slate-200")}
               title="Bold"
             >
               <Bold size={14} />
             </button>
             <button 
               onClick={() => editor.chain().focus().toggleItalic().run()}
               className={cn("p-1.5 rounded-full hover:bg-slate-700 transition-colors", editor.isActive('italic') ? "text-indigo-400 bg-slate-800" : "text-slate-200")}
               title="Italic"
             >
               <Italic size={14} />
             </button>
           </div>
           
           <div className="flex items-center gap-1.5 px-1 overflow-x-auto no-scrollbar max-w-[70vw] sm:max-w-none">
             <button 
               onClick={() => onAiAction("Show don't tell")}
               className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1.5 shrink-0"
             >
               <Sparkles size={10} className="text-indigo-400" />
               Show
             </button>
             <button 
               onClick={() => onAiAction("Focus Senses")}
               className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors shrink-0"
             >
               Senses
             </button>
             <button 
               onClick={() => onAiAction("Intensify")}
               className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors shrink-0"
             >
               Intensify
             </button>
             {customActions?.map((action) => (
               <button 
                 key={action.id}
                 onClick={() => onAiAction(action.prompt)} 
                 className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors shrink-0"
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
