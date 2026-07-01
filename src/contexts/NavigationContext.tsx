/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ViewMode, WorkshopTarget } from '@/src/types';
import { useProject } from '@/src/contexts/ProjectContext';

const VIEW_MODE_STORAGE_KEY = 'aether_view_mode';
const VALID_VIEW_MODES: ViewMode[] = [
  'write', 'outline', 'codex', 'bible', 'settings', 'actions', 'relationships',
  'guide', 'errors', 'brainstorm', 'dashboard', 'consistency', 'timeline', 'orphans', 'continuity', 'arc', 'prose', 'workshop',
];

/** Baca panel terakhir dari localStorage; fallback ke 'write' bila kosong/tidak valid. */
function loadInitialViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved && VALID_VIEW_MODES.includes(saved as ViewMode)) {
      return saved as ViewMode;
    }
  } catch {
    // localStorage tidak tersedia (mode privasi/SSR) — pakai default.
  }
  return 'write';
}

interface NavigationContextType {
  activeChapterId: number | null;
  setActiveChapterId: (id: number | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** Teks yang harus disorot & di-scroll di editor setelah berpindah ke sana. */
  pendingHighlight: string | null;
  /** Pindah ke editor pada bab tertentu lalu sorot sepotong teks (mis. dari Cek Konsistensi). */
  jumpToText: (chapterId: number, text: string) => void;
  clearPendingHighlight: () => void;
  /** Sasaran sesi Lokakarya Codex yang sedang aktif (null bila tidak sedang di Lokakarya). */
  workshopTarget: WorkshopTarget | null;
  /** Buka Lokakarya Codex untuk entitas tertentu; mengingat panel asal untuk tombol Kembali. */
  openWorkshop: (target: WorkshopTarget) => void;
  /** Tutup Lokakarya dan kembali ke panel sebelum membukanya (default 'codex'). */
  closeWorkshop: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useProject();
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(loadInitialViewMode);
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null);
  const [workshopTarget, setWorkshopTarget] = useState<WorkshopTarget | null>(null);
  // Lacak proyek sebelumnya agar bisa membedakan refresh (restore panel) vs ganti proyek (reset ke editor).
  const prevProjectIdRef = useRef<number | null>(null);
  // Panel asal sebelum membuka Lokakarya, agar tombol Kembali memulihkan tempat semula.
  const workshopReturnRef = useRef<ViewMode>('codex');

  const jumpToText = useCallback((chapterId: number, text: string) => {
    setActiveChapterId(chapterId);
    setViewMode('write');
    setPendingHighlight(text);
  }, []);

  const clearPendingHighlight = useCallback(() => setPendingHighlight(null), []);

  const openWorkshop = useCallback((target: WorkshopTarget) => {
    setViewMode(prev => {
      // 'workshop' bersifat transien — jangan jadikan titik kembali bila dibuka berulang.
      if (prev !== 'workshop') workshopReturnRef.current = prev;
      return 'workshop';
    });
    setWorkshopTarget(target);
  }, []);

  const closeWorkshop = useCallback(() => {
    setWorkshopTarget(null);
    setViewMode(workshopReturnRef.current || 'codex');
  }, []);

  // Simpan panel terakhir agar bertahan setelah refresh browser. 'workshop' sengaja
  // TIDAK dipersist (sesi transien tanpa sasaran tersimpan) → refresh kembali ke panel asal.
  useEffect(() => {
    if (viewMode === 'workshop') return;
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // localStorage tidak tersedia — abaikan.
    }
  }, [viewMode]);

  // Load first chapter when project changes
  useEffect(() => {
    if (projectId) {
      db.chapters.where('projectId').equals(projectId).first().then(ch => {
        if (ch) setActiveChapterId(ch.id!);
      });
      // Hanya reset ke editor saat benar-benar BERPINDAH proyek, bukan saat
      // proyek pertama dimuat (refresh) — agar panel terpulihkan dari localStorage.
      if (prevProjectIdRef.current !== null && prevProjectIdRef.current !== projectId) {
        setViewMode('write');
      }
      prevProjectIdRef.current = projectId;
    }
  }, [projectId]);

  // Handle case where active chapter is deleted
  useEffect(() => {
    let isMounted = true;

    const syncActiveChapter = async () => {
      if (!activeChapterId || !projectId) return;

      const current = await db.chapters.get(activeChapterId);
      
      if (!current && isMounted) {
        const nextCh = await db.chapters.where('projectId').equals(projectId).first();
        if (isMounted) {
          setActiveChapterId(nextCh?.id || null);
        }
      }
    };

    if (activeChapterId) {
      syncActiveChapter();
    }

    return () => { isMounted = false; };
  }, [activeChapterId, projectId]);

  return (
    <NavigationContext.Provider value={{
      activeChapterId,
      setActiveChapterId,
      viewMode,
      setViewMode,
      pendingHighlight,
      jumpToText,
      clearPendingHighlight,
      workshopTarget,
      openWorkshop,
      closeWorkshop
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
