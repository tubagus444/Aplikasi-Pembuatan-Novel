import { ChapterStatus } from '../types';

export const PANEL_WIDTH = 340;

export const DB_KEY_MAP: Record<string, string> = {
  title: '__STORY_TITLE__',
  tagline: '__STORY_TAGLINE__',
  premise: '__CORE_PREMISE__',
  setting: '__WORLD_SETTING__',
  themes: '__THEMES__',
  notes: '__AUTHOR_NOTES__',
};

export const STATUS_COLORS: Record<ChapterStatus, string> = {
  outline: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  draft: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
  edit: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  polish: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  done: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
};

export const STATUS_DOTS: Record<ChapterStatus, string> = {
  outline: 'bg-slate-300',
  draft: 'bg-indigo-400',
  edit: 'bg-amber-400',
  polish: 'bg-emerald-400',
  done: 'bg-blue-500'
};
