/**
 * Sumber tunggal untuk kategori Codex: definisi bawaan, registry ikon & warna yang
 * boleh dipakai kategori kustom, plus helper resolusi slug→label/ikon/warna.
 *
 * Kategori bawaan tidak dapat dihapus/diedit. Kategori kustom (tabel `codexCategories`,
 * lihat src/db.ts) menyimpan kunci `icon`/`color` yang merujuk ke registry di sini.
 */
import {
  User, MapPin, Sparkles, Tag, BookOpen, CalendarClock,
  Sword, Shield, Crown, Flag, Users, Gem, Scroll, Skull,
  Leaf, Flame, Globe, Heart, Star, Zap, Building2, Map,
  type LucideIcon,
} from 'lucide-react';
import type { CodexCategory, CustomCategory } from '@/src/types';

export interface CategoryDef {
  slug: string;
  label: string;
  icon: string;  // kunci ICON_REGISTRY
  color: string; // kunci COLOR_REGISTRY
  builtin?: boolean;
}

// Ikon yang tersedia untuk dipilih kategori kustom. Hanya ikon di sini yang di-bundle.
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  user: User,
  'map-pin': MapPin,
  sparkles: Sparkles,
  tag: Tag,
  book: BookOpen,
  calendar: CalendarClock,
  sword: Sword,
  shield: Shield,
  crown: Crown,
  flag: Flag,
  users: Users,
  gem: Gem,
  scroll: Scroll,
  skull: Skull,
  leaf: Leaf,
  flame: Flame,
  globe: Globe,
  heart: Heart,
  star: Star,
  zap: Zap,
  building: Building2,
  map: Map,
};

// Daftar urut kunci ikon untuk pemilih di UI.
export const ICON_KEYS = Object.keys(ICON_REGISTRY);

// Warna teks (kelas Tailwind ditulis literal agar tidak ter-purge). Dipakai untuk ikon.
export const COLOR_REGISTRY: Record<string, string> = {
  indigo: 'text-indigo-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  rose: 'text-rose-500',
  sky: 'text-sky-500',
  slate: 'text-slate-400 dark:text-slate-500',
  violet: 'text-violet-500',
  teal: 'text-teal-500',
  orange: 'text-orange-500',
  red: 'text-red-500',
  green: 'text-green-500',
  blue: 'text-blue-500',
  pink: 'text-pink-500',
  cyan: 'text-cyan-500',
  lime: 'text-lime-500',
  fuchsia: 'text-fuchsia-500',
};

export const COLOR_KEYS = Object.keys(COLOR_REGISTRY);

const FALLBACK_COLOR = 'text-slate-400 dark:text-slate-500';

// Kategori bawaan — selaras dengan ikon/warna lama di CategoryIcon.
export const BUILTIN_CATEGORIES: CategoryDef[] = [
  { slug: 'character', label: 'Karakter', icon: 'user', color: 'indigo', builtin: true },
  { slug: 'location', label: 'Lokasi', icon: 'map-pin', color: 'emerald', builtin: true },
  { slug: 'magic', label: 'Sistem Sihir', icon: 'sparkles', color: 'amber', builtin: true },
  { slug: 'item', label: 'Item & Artefak', icon: 'tag', color: 'rose', builtin: true },
  { slug: 'event', label: 'Peristiwa', icon: 'calendar', color: 'sky', builtin: true },
  { slug: 'other', label: 'Lore Lainnya', icon: 'book', color: 'slate', builtin: true },
];

const BUILTIN_SLUGS = new Set(BUILTIN_CATEGORIES.map(c => c.slug));

export function isBuiltinSlug(slug: string): boolean {
  return BUILTIN_SLUGS.has(slug);
}

export function resolveIcon(name: string): LucideIcon {
  return ICON_REGISTRY[name] ?? BookOpen;
}

export function resolveColor(key: string): string {
  return COLOR_REGISTRY[key] ?? FALLBACK_COLOR;
}

/** Ubah label menjadi slug aman (kebab-case ASCII). */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')    // buang diakritik
    .replace(/[^a-z0-9]+/g, '-')        // non-alnum → strip
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Gabungkan kategori bawaan + kustom (terurut `order`) menjadi satu daftar tampil. */
export function mergeCategories(custom: CustomCategory[] | undefined): CategoryDef[] {
  const customDefs = (custom ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label, 'id'))
    .map<CategoryDef>(c => ({ slug: c.slug, label: c.label, icon: c.icon, color: c.color }));
  return [...BUILTIN_CATEGORIES, ...customDefs];
}

/** Cari definisi kategori menurut slug. Default ke daftar bawaan bila `categories` kosong. */
export function getCategoryDef(slug: CodexCategory, categories?: CategoryDef[]): CategoryDef | undefined {
  const list = categories ?? BUILTIN_CATEGORIES;
  return list.find(c => c.slug === slug);
}

/** Label tampil untuk sebuah slug; fallback ke slug mentah bila tak dikenal. */
export function getCategoryLabel(slug: CodexCategory, categories?: CategoryDef[]): string {
  return getCategoryDef(slug, categories)?.label ?? String(slug);
}
