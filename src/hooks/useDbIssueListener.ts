import { useEffect } from 'react';
import { useToast } from '@/src/hooks/useToast';
import { drainPendingDbIssues, setDbIssueListenerAttached, DbIssue } from '@/src/db';

type DbIssueDetail = DbIssue;

/**
 * Menyurfacekan event `aetherscribe-db-issue` yang di-dispatch `db.ts` (DB terblokir /
 * gagal dibuka / diperbarui di tab lain) ke pengguna. Tanpa listener, kegagalan paling
 * fatal (IndexedDB gagal dibuka = data tak termuat) hanya muncul di console.
 *
 * `db.ts` sengaja TIDAK memakai ErrorService (menulis db.errors bisa ikut menggantung
 * saat DB-nya sendiri bermasalah) → jembatannya adalah window event ini.
 */
export function useDbIssueListener() {
  const { toast } = useToast();

  useEffect(() => {
    const surface = (detail: DbIssueDetail) => {
      if (detail.level === 'error') {
        // Fatal (mis. gagal buka DB) → toast persisten + tawaran muat ulang.
        toast.error(detail.message, {
          duration: null,
          action: { label: 'Muat Ulang', onClick: () => window.location.reload() },
        });
      } else {
        toast.warning(detail.message);
      }
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DbIssueDetail>).detail;
      if (detail) surface(detail);
    };

    // Kuras isu yang muncul sebelum listener terpasang (mis. gagal buka DB saat load).
    drainPendingDbIssues().forEach(surface);

    setDbIssueListenerAttached(true);
    window.addEventListener('aetherscribe-db-issue', handler);
    return () => {
      window.removeEventListener('aetherscribe-db-issue', handler);
      setDbIssueListenerAttached(false);
    };
  }, [toast]);
}
