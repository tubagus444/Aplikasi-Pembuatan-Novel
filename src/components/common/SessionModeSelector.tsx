import React from 'react';
import { createPortal } from 'react-dom';
import { PenTool, Layers, Zap, X } from 'lucide-react';
import { SessionMode } from '../../types';

interface SessionModeSelectorProps {
  onSelect: (mode: SessionMode, smartAutoEnabled: boolean) => void;
  onCancel: () => void;
}

export function SessionModeSelector({ onSelect, onCancel }: SessionModeSelectorProps) {
  const modes: { id: SessionMode; title: string; desc: string; icon: React.ReactNode; defaultAuto: boolean }[] = [
    {
      id: 'prose-review',
      title: 'Review Prosa',
      desc: 'Fokus ke kualitas teks, ritme, gaya bahasa, "show don\'t tell".',
      icon: <PenTool size={20} />,
      defaultAuto: true
    },
    {
      id: 'plot-check',
      title: 'Plot & Konsistensi',
      desc: 'Fokus ke big picture, karakter, pacing, dan alur logika.',
      icon: <Layers size={20} />,
      defaultAuto: true
    },
    {
      id: 'brainstorm',
      title: 'Brainstorm Bebas',
      desc: 'Sesi ide liar tanpa constraint ketat dari chapter.',
      icon: <Zap size={20} />,
      defaultAuto: false
    }
  ];

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pilih Mode Sesi AI</h2>
          <button onClick={onCancel} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id, m.defaultAuto)}
              className="w-full relative group p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-4 text-left transition-all hover:border-indigo-500 hover:shadow-md hover:bg-indigo-50/50 dark:hover:bg-slate-800"
             >
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                {m.icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-bold text-slate-900 dark:text-slate-100 mb-1">{m.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
             </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
