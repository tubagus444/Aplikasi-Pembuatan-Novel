import React, { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react';

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      if (props.editor && props.range) {
        props.editor
          .chain()
          .focus()
          .insertContentAt(props.range, item.name)
          .setMeta('forceUpdateCodex', true)
          .run();
      } else {
        props.command({ id: item.name, label: item.name });
      }
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const selected = scrollContainerRef.current.children[selectedIndex + 1] as HTMLElement;
      if (selected && selected.scrollIntoView) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  const getCategoryStyles = (category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('karakter') || cat.includes('tokoh') || cat.includes('character') || cat.includes('actor')) {
      return {
        bg: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30',
        emoji: '👤',
        label: 'Karakter'
      };
    }
    if (cat.includes('tempat') || cat.includes('lokasi') || cat.includes('place') || cat.includes('setting')) {
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30',
        emoji: '📍',
        label: 'Tempat'
      };
    }
    if (cat.includes('faksi') || cat.includes('faction') || cat.includes('grup') || cat.includes('clan')) {
      return {
        bg: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30',
        emoji: '🛡️',
        label: 'Faksi'
      };
    }
    if (cat.includes('item') || cat.includes('barang') || cat.includes('senjata') || cat.includes('object')) {
      return {
        bg: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30',
        emoji: '🧩',
        label: 'Barang'
      };
    }
    return {
      bg: 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/30',
      emoji: '🔑',
      label: category || 'Lore'
    };
  };

  return (
    <div ref={scrollContainerRef} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 flex flex-col w-[320px] text-sm text-slate-800 dark:text-slate-100 font-sans max-h-[350px] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
            Saran Codex ({props.items.length})
          </span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 lowercase font-medium">
            ↑↓ navigasi ↵ pilih
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span className={`text-xs ${props.query ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}`}>
            {props.query ? `Mencari: "${props.query}"` : 'Ketik untuk mencari...'}
          </span>
        </div>
      </div>
      <div className="p-1.5 overflow-y-auto flex flex-col gap-0.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800 custom-scrollbar">
        {props.items.length ? (
          props.items.map((item: any, index: number) => {
            const styles = getCategoryStyles(item.category);
            return (
              <button
                className={`text-left px-3 py-2 transition-all w-full flex flex-col shrink-0 rounded-lg ${
                  index === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800 text-slate-900 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
                key={index}
                onClick={() => selectItem(index)}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className={`font-semibold flex items-center gap-1.5 ${index === selectedIndex ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-slate-200'}`}>
                    <span className="text-xs">{styles.emoji}</span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${styles.bg}`}>
                    {styles.label}
                  </span>
                </div>
                
                {/* description preview */}
                {item.description && (
                  <span className={`text-[11px] font-normal leading-relaxed mt-1 line-clamp-2 pl-[22px] ${index === selectedIndex ? 'text-indigo-700/80 dark:text-indigo-300/80' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item.description}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <span className="px-3 py-4 text-slate-400 dark:text-slate-500 italic text-xs block text-center">Tidak ada kecocokan Codex...</span>
        )}
      </div>
    </div>
  );
});
