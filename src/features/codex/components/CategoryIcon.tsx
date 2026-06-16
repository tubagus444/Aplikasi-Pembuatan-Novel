import React from 'react';
import { CodexCategory } from '@/src/types';
import { getCategoryDef, resolveIcon, resolveColor, type CategoryDef } from '@/src/lib/codexCategories';

interface CategoryIconProps {
  category: CodexCategory;
  /** Daftar kategori (bawaan + kustom). Bila kosong, hanya kategori bawaan dikenali. */
  categories?: CategoryDef[];
  size?: number;
}

export function CategoryIcon({ category, categories, size = 20 }: CategoryIconProps) {
  const def = getCategoryDef(category, categories);
  const Icon = def ? resolveIcon(def.icon) : resolveIcon('book');
  const color = def ? resolveColor(def.color) : resolveColor('slate');
  return <Icon size={size} className={color} />;
}
