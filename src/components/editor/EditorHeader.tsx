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
    <div className="pt-8 pb-4 mb-4 border-b border-transparent group-focus-within:border-slate-100 dark:group-focus-within:border-slate-800 transition-all">
      <div className="mb-6 group">
        <input 
          type="text" 
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Judul Bab..."
          className="w-full text-4xl font-serif font-bold text-foreground focus:outline-none placeholder:text-slate-200 dark:placeholder:text-slate-800 dark:text-slate-200 placeholder:italic border-none selection:bg-indigo-100 dark:selection:bg-indigo-900 mb-2 truncate bg-transparent"
        />
        <div className="h-px w-24 bg-indigo-200 group-focus-within:w-48 transition-all duration-500" />
      </div>
    </div>
  );
}
