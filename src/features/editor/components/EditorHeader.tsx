/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EditorHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
}

export function EditorHeader({ title, onTitleChange }: EditorHeaderProps) {
  return (
    <div className="mb-12 flex flex-col items-center group">
      <input 
        type="text" 
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Judul Bab..."
        className="w-full text-center text-4xl sm:text-5xl font-serif font-bold text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 bg-transparent transition-all leading-tight"
      />
      <div className="h-0.5 w-12 bg-slate-200 dark:bg-slate-800 mt-6 group-focus-within:w-24 group-focus-within:bg-indigo-400/60 transition-all duration-700 rounded-full" />
    </div>
  );
}
