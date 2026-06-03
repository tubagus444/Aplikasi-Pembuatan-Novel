import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Database } from 'lucide-react';

export function IndexingIndicator() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [status, setStatus] = useState('');

  useEffect(() => {
    const handleProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      const { type, total, completed, info } = payload;

      if (type === 'model_download') {
        setIsIndexing(true);
        if (info && info.progress) {
          setProgress(Math.round(info.progress));
        } else if (info && info.status === 'download') {
           setStatus('Downloading models...');
        } else if (info && info.status === 'initiate') {
           setStatus('Initializing AI models...');
        } else if (info && info.status === 'done') {
           setStatus('Model loaded.');
           setTimeout(() => setIsIndexing(false), 2000);
        } else {
           setStatus('Initializing semantic search...');
        }
      } else if (type === 'embedding_start') {
        setIsIndexing(true);
        setProgress(0);
        setStatus('Indexing Lore...');
      } else if (type === 'embedding_progress') {
        setIsIndexing(true);
        if (total) {
          setProgress(Math.round((completed / total) * 100));
        }
        setStatus('Generating Embeddings...');
      } else if (type === 'embedding_done') {
        setStatus('Indexing Complete.');
        setTimeout(() => setIsIndexing(false), 2000);
      }
    };

    window.addEventListener('semantic-indexing-progress', handleProgress);
    return () => window.removeEventListener('semantic-indexing-progress', handleProgress);
  }, []);

  return (
    <AnimatePresence>
      {isIndexing && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-6 right-6 flex items-center gap-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/50 z-[9999] overflow-hidden min-w-[200px]"
        >
           <div 
             className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-300 ease-out" 
             style={{ width: `${progress}%` }} 
           />
           <div className="relative">
             <Database className="w-5 h-5 text-indigo-400" />
             {status !== 'Indexing Complete.' && status !== 'Model loaded.' && (
               <Loader2 className="w-3 h-3 animate-spin text-indigo-500 absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full" />
             )}
           </div>
           
           <div className="flex flex-col">
             <span className="text-sm font-medium pr-4">{status || 'Processing...'}</span>
             {progress > 0 && progress < 100 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {progress}% complete
                </span>
             )}
           </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
