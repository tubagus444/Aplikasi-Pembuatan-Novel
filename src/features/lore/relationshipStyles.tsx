import type { LucideIcon } from 'lucide-react';
import { Link as LinkIcon, Users, Heart, Sword, Shield, Home, Package, Handshake } from 'lucide-react';

/**
 * Metadata visual per tipe relasi, di-key oleh `value` dari sumber tunggal
 * `relationshipTypes.ts`. Label & urutan tetap berasal dari RELATIONSHIP_TYPES —
 * di sini hanya ikon/warna. Semua 8 tipe punya gaya sendiri agar tak ada yang
 * jatuh diam-diam ke "Other".
 *
 * Diangkat ke modul bersama agar dipakai lintas-fitur (RelationshipMapper &
 * Panel Faksi #15) tanpa duplikasi peta warna — pola `TYPE_STYLE.hex` yang sudah
 * dirujuk di LoreGraphPanel.
 */
export interface TypeStyle {
  icon: LucideIcon;
  color: string;
  activeClass: string;
  border: string;
  hex: string;
  dashed?: boolean;
}

export const TYPE_STYLE: Record<string, TypeStyle> = {
  Friend: { icon: Handshake, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', activeClass: 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-500/20', border: 'border-blue-200 dark:border-blue-900/50', hex: '#3b82f6' },
  Enemy: { icon: Sword, color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400', activeClass: 'border-red-500 ring-1 ring-red-500 bg-red-50/50 dark:bg-red-500/20', border: 'border-red-200 dark:border-red-900/50', hex: '#ef4444' },
  Family: { icon: Users, color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400', activeClass: 'border-violet-500 ring-1 ring-violet-500 bg-violet-50/50 dark:bg-violet-500/20', border: 'border-violet-200 dark:border-violet-900/50', hex: '#8b5cf6' },
  Lover: { icon: Heart, color: 'text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-400', activeClass: 'border-pink-500 ring-1 ring-pink-500 bg-pink-50/50 dark:bg-pink-500/20', border: 'border-pink-200 dark:border-pink-900/50', hex: '#ec4899' },
  Ally: { icon: Shield, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', activeClass: 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/20', border: 'border-emerald-200 dark:border-emerald-900/50', hex: '#10b981' },
  'Resides In': { icon: Home, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400', activeClass: 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/50 dark:bg-amber-500/20', border: 'border-amber-200 dark:border-amber-900/50', hex: '#f59e0b' },
  Owns: { icon: Package, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10 dark:text-cyan-400', activeClass: 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-50/50 dark:bg-cyan-500/20', border: 'border-cyan-200 dark:border-cyan-900/50', hex: '#06b6d4' },
  Other: { icon: LinkIcon, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', activeClass: 'border-slate-500 ring-1 ring-slate-500 bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-800', hex: '#94a3b8', dashed: true },
};

export const styleOf = (type: string): TypeStyle => TYPE_STYLE[type] || TYPE_STYLE.Other;
