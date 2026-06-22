/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/core';
import { ListTree, Hash } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface ChapterOutlineProps {
  editor: Editor | null;
}

/**
 * Mini-TOC: daftar heading (H1–H3) bab aktif untuk navigasi cepat di dalam bab
 * panjang. Diturunkan langsung dari dokumen editor (ter-debounce), menyorot bagian
 * tempat kursor berada, dan melompat + menggulir ke heading saat diklik.
 */
export function ChapterOutline({ editor }: ChapterOutlineProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      setActivePos(null);
      return;
    }

    const extract = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          items.push({ level: node.attrs.level ?? 1, text: node.textContent.trim(), pos });
        }
      });
      setHeadings(items);
    };

    // Bagian aktif = heading terakhir yang posisinya berada di atas / pada kursor.
    const syncActive = () => {
      const from = editor.state.selection.from;
      let current: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && pos <= from) current = pos;
      });
      setActivePos(current);
    };

    const onUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(extract, 300);
    };

    extract();
    syncActive();
    editor.on('update', onUpdate);
    editor.on('selectionUpdate', syncActive);
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', syncActive);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor]);

  const jumpTo = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 h-full flex flex-col">
      <header className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <ListTree size={14} />
          Kerangka Bab
        </h2>
        {headings.length > 0 && (
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {headings.length}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {headings.length > 0 ? (
          <nav className="flex flex-col gap-0.5" aria-label="Kerangka bab">
            {headings.map((h, i) => {
              const active = h.pos === activePos;
              return (
                <button
                  key={`${h.pos}-${i}`}
                  onClick={() => jumpTo(h.pos)}
                  aria-current={active ? 'location' : undefined}
                  style={{ paddingLeft: `${(h.level - 1) * 14 + 8}px` }}
                  className={cn(
                    "group w-full text-left flex items-center gap-2 pr-2 py-1.5 rounded-lg transition-colors",
                    active
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Hash
                    size={11}
                    className={cn(
                      "shrink-0",
                      active ? "text-indigo-500" : "text-slate-300 dark:text-slate-600 group-hover:text-slate-400"
                    )}
                  />
                  <span
                    className={cn(
                      "truncate",
                      h.level === 1 ? "text-[13px] font-semibold" : h.level === 2 ? "text-xs font-medium" : "text-xs"
                    )}
                  >
                    {h.text || <span className="italic opacity-50">Tanpa judul</span>}
                  </span>
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="text-center py-12 px-4">
            <ListTree size={24} className="mx-auto text-slate-200 dark:text-slate-700 mb-2 opacity-40" />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic leading-relaxed">
              Belum ada heading di bab ini.<br />
              Gunakan H1–H3 dari bilah alat untuk menyusun kerangka.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
