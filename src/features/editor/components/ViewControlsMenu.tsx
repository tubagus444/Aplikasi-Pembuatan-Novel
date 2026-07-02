/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Zap, Type, Minus, Plus, Check, SpellCheck, BookMarked } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const SPELLCHECK_KEY = 'spellcheck_names';
const GLOSSARY_KEY = 'glossary_check';
/** Default AKTIF (fitur nol-token); hanya `'false'` yang mematikan. */
function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) !== 'false'; } catch { return true; }
}

interface ViewControlsMenuProps {
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
  isFocusMode?: boolean;
  setIsFocusMode: (val: boolean) => void;
  isTypewriterMode: boolean;
  setIsTypewriterMode: (val: boolean) => void;
}

/**
 * Popover "Tampilan" — menggabungkan kontrol tampilan (zoom, mode fokus,
 * mode mesin tik) yang sebelumnya berserakan di footer menjadi satu menu.
 */
export function ViewControlsMenu({
  zoomLevel,
  setZoomLevel,
  isFocusMode,
  setIsFocusMode,
  isTypewriterMode,
  setIsTypewriterMode
}: ViewControlsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [spellcheck, setSpellcheck] = useState<boolean>(() => readFlag(SPELLCHECK_KEY));
  const [glossary, setGlossary] = useState<boolean>(() => readFlag(GLOSSARY_KEY));

  const toggleFlag = (key: string, value: boolean, setter: (v: boolean) => void) => {
    const next = !value;
    setter(next);
    try { localStorage.setItem(key, next ? 'true' : 'false'); } catch { /* abaikan */ }
    // Beri tahu hook editor di tab yang sama ('storage' native tak menyala untuk tab pengubah).
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const ToggleRow = ({
    icon: Icon,
    label,
    active,
    onClick,
    hint
  }: {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    onClick: () => void;
    hint?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg transition-colors text-left",
        active
          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon size={15} className={active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
        <span className="flex flex-col">
          <span className="text-xs font-semibold">{label}</span>
          {hint && <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">{hint}</span>}
        </span>
      </span>
      <span className={cn("w-4 h-4 flex items-center justify-center", !active && "opacity-0")}>
        <Check size={14} />
      </span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Pengaturan tampilan"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-1.5 p-1.5 rounded transition-colors",
          open ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
        title="Pengaturan Tampilan"
      >
        <SlidersHorizontal size={14} />
        <span className="hidden lg:inline">Tampilan</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 p-2 z-[60] normal-case tracking-normal">
          {/* Zoom */}
          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ukuran Teks</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-full px-1 py-0.5 border border-slate-200/50 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"
                title="Perkecil"
              >
                <Minus size={12} strokeWidth={3} />
              </button>
              <span className="w-9 text-center font-mono text-[10px] text-slate-600 dark:text-slate-300 font-bold select-none">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(Math.min(250, zoomLevel + 10))}
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"
                title="Perbesar"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

          <ToggleRow
            icon={Zap}
            label="Mode Fokus"
            hint="Sembunyikan antarmuka (Ctrl+Alt+F)"
            active={isFocusMode}
            onClick={() => { setIsFocusMode(!isFocusMode); setOpen(false); }}
          />
          <ToggleRow
            icon={Type}
            label="Mode Mesin Tik"
            hint="Baris aktif tetap di tengah"
            active={isTypewriterMode}
            onClick={() => setIsTypewriterMode(!isTypewriterMode)}
          />

          <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

          <ToggleRow
            icon={SpellCheck}
            label="Periksa Ejaan Nama"
            hint="Tandai salah ketik nama Codex (nol token)"
            active={spellcheck}
            onClick={() => toggleFlag(SPELLCHECK_KEY, spellcheck, setSpellcheck)}
          />
          <ToggleRow
            icon={BookMarked}
            label="Periksa Glosarium"
            hint="Tandai istilah tak baku (teal, nol token)"
            active={glossary}
            onClick={() => toggleFlag(GLOSSARY_KEY, glossary, setGlossary)}
          />
        </div>
      )}
    </div>
  );
}
