import React from 'react';
import { User, MapPin, Sparkles, Tag, BookOpen } from 'lucide-react';
import { CodexCategory } from '../../types';

export function CategoryIcon({ category }: { category: CodexCategory }) {
  switch (category) {
    case 'character': return <User size={20} className="text-indigo-500" />;
    case 'location': return <MapPin size={20} className="text-emerald-500" />;
    case 'magic': return <Sparkles size={20} className="text-amber-500" />;
    case 'item': return <Tag size={20} className="text-rose-500" />;
    default: return <BookOpen size={20} className="text-slate-400 dark:text-slate-500" />;
  }
}
