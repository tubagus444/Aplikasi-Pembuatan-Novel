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
import type { CodexCategory, CustomCategory, CategoryFieldDef } from '@/src/types';

export interface CategoryDef {
  slug: string;
  label: string;
  icon: string;  // kunci ICON_REGISTRY
  color: string; // kunci COLOR_REGISTRY
  builtin?: boolean;
  /** Template field (#17) — hanya kategori kustom yang bisa punya; bawaan tak berisi. */
  fields?: CategoryFieldDef[];
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

/** Aksen warna kategori untuk pemindaian cepat di kartu (latar ikon lembut + bar solid). */
export interface CategoryAccent {
  /** Latar lembut untuk wadah ikon. */
  iconBg: string;
  /** Warna solid untuk aksen garis/tepi kartu. */
  bar: string;
}

// Kelas ditulis literal (bukan string template) agar tidak ter-purge Tailwind.
const ACCENT_REGISTRY: Record<string, CategoryAccent> = {
  indigo:  { iconBg: 'bg-indigo-50 dark:bg-indigo-500/10',   bar: 'bg-indigo-500' },
  emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', bar: 'bg-emerald-500' },
  amber:   { iconBg: 'bg-amber-50 dark:bg-amber-500/10',     bar: 'bg-amber-500' },
  rose:    { iconBg: 'bg-rose-50 dark:bg-rose-500/10',       bar: 'bg-rose-500' },
  sky:     { iconBg: 'bg-sky-50 dark:bg-sky-500/10',         bar: 'bg-sky-500' },
  slate:   { iconBg: 'bg-slate-100 dark:bg-slate-800',       bar: 'bg-slate-400 dark:bg-slate-600' },
  violet:  { iconBg: 'bg-violet-50 dark:bg-violet-500/10',   bar: 'bg-violet-500' },
  teal:    { iconBg: 'bg-teal-50 dark:bg-teal-500/10',       bar: 'bg-teal-500' },
  orange:  { iconBg: 'bg-orange-50 dark:bg-orange-500/10',   bar: 'bg-orange-500' },
  red:     { iconBg: 'bg-red-50 dark:bg-red-500/10',         bar: 'bg-red-500' },
  green:   { iconBg: 'bg-green-50 dark:bg-green-500/10',     bar: 'bg-green-500' },
  blue:    { iconBg: 'bg-blue-50 dark:bg-blue-500/10',       bar: 'bg-blue-500' },
  pink:    { iconBg: 'bg-pink-50 dark:bg-pink-500/10',       bar: 'bg-pink-500' },
  cyan:    { iconBg: 'bg-cyan-50 dark:bg-cyan-500/10',       bar: 'bg-cyan-500' },
  lime:    { iconBg: 'bg-lime-50 dark:bg-lime-500/10',       bar: 'bg-lime-500' },
  fuchsia: { iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', bar: 'bg-fuchsia-500' },
};

const FALLBACK_ACCENT: CategoryAccent = { iconBg: 'bg-slate-100 dark:bg-slate-800', bar: 'bg-slate-400 dark:bg-slate-600' };

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

export function resolveAccent(key: string): CategoryAccent {
  return ACCENT_REGISTRY[key] ?? FALLBACK_ACCENT;
}

/** Aksen warna untuk sebuah kategori (slug). */
export function getCategoryAccent(slug: CodexCategory, categories?: CategoryDef[]): CategoryAccent {
  const def = getCategoryDef(slug, categories);
  return resolveAccent(def?.color ?? 'slate');
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
    .map<CategoryDef>(c => ({ slug: c.slug, label: c.label, icon: c.icon, color: c.color, fields: c.fields }));
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
