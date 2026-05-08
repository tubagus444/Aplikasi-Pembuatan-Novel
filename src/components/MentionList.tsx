import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.name });
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

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col min-w-[200px] py-1 text-sm text-slate-100 font-sans overflow-hidden">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`text-left px-3 py-2 transition-colors w-full flex flex-col gap-0.5 ${
              index === selectedIndex ? 'bg-slate-800' : 'hover:bg-slate-800'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <span className="font-bold">{item.name}</span>
            <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">{item.category}</span>
          </button>
        ))
      ) : (
        <span className="px-3 py-2 text-slate-500 italic text-xs">No exact matches...</span>
      )}
    </div>
  );
});
