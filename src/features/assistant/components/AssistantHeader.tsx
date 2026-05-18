import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Edit2, Check, X, MoreVertical, Trash2 } from 'lucide-react';
import { db } from '@/src/db';
import { ChatSession } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface AssistantHeaderProps {
  activeSessionId: number;
  activeSession: ChatSession | undefined;
  onBack: () => void;
  onSessionDeleted: () => void;
}

export function AssistantHeader({
  activeSessionId,
  activeSession,
  onBack,
  onSessionDeleted
}: AssistantHeaderProps) {
  const [isHeaderEditing, setIsHeaderEditing] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRename = async () => {
    if (!editTitleValue.trim()) {
      setIsHeaderEditing(false);
      return;
    }
    try {
      await db.chatSessions.update(activeSessionId, { title: editTitleValue.trim() });
      setIsHeaderEditing(false);
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const deleteSession = async () => {
    try {
      await db.chatSessions.delete(activeSessionId);
      onSessionDeleted();
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const toggleSmartAuto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeSessionId) {
      await db.chatSessions.update(activeSessionId, { smartAutoEnabled: e.target.checked });
    }
  };

  return (
    <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg lg:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          {isHeaderEditing ? (
            <div className="flex items-center gap-2">
              <input 
                autoFocus
                value={editTitleValue}
                onChange={e => setEditTitleValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsHeaderEditing(false);
                }}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-1 text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 w-full max-w-xs"
              />
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleRename}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                  title="Simpan"
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => setIsHeaderEditing(false)}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Batal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 
                className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-md cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-2"
                onClick={() => {
                  setEditTitleValue(activeSession?.title || '');
                  setIsHeaderEditing(true);
                }}
              >
                {activeSession?.title}
                {activeSession?.mode && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                      {activeSession.mode.replace('-', ' ')}
                    </span>
                )}
              </h3>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  Integrated with lore
                </p>
                {activeSession?.mode !== 'brainstorm' && (
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={!!activeSession?.smartAutoEnabled}
                        className="sr-only"
                        onChange={toggleSmartAuto}
                      />
                      <div className={cn(
                        "w-6 h-3.5 rounded-full transition-colors relative",
                        activeSession?.smartAutoEnabled ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"
                      )}>
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-transform",
                          activeSession?.smartAutoEnabled ? "translate-x-3" : "translate-x-0.5"
                        )} />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                        Smart Auto
                      </span>
                  </label>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="relative" ref={moreMenuRef}>
        <button 
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={cn(
            "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors",
            showMoreMenu ? "bg-slate-100 dark:bg-slate-800 text-indigo-600" : "text-slate-400"
          )}
          title="Menu"
        >
          <MoreVertical size={20} />
        </button>

        {showMoreMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
            <button
              onClick={() => {
                setEditTitleValue(activeSession?.title || '');
                setIsHeaderEditing(true);
                setShowMoreMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors border-b border-slate-100 dark:border-slate-800"
            >
              <Edit2 size={16} />
              Ganti Nama
            </button>
            <button
              onClick={deleteSession}
              className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
            >
              <Trash2 size={16} />
              Hapus Percakapan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
