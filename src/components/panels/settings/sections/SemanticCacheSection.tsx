import React from 'react';
import { BrainCircuit, RefreshCcw } from 'lucide-react';
import { clearEmbeddingCache } from '@/src/services/contextEngine';

export function SemanticCacheSection() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <BrainCircuit size={18} className="text-indigo-500" />
        <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Cache Semantik & Vektor</h3>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            Indeks vektor untuk pencarian semantik (Global Search) dan <strong>Auto-Summarizer</strong> yang berjalan di latar belakang akan diperbarui secara inkremental. Jika ada state semantik yang tidak konsisten atau hilang, Anda dapat membersihkan cachenya untuk memaksa pemrosesan ulang secara penuh.
          </p>
        </div>

        <button
          onClick={async () => {
            if (window.confirm('Apakah Anda yakin ingin menghapus seluruh cache penyematan vektor semantik? Background worker akan membangun ulangnya secara asinkron.')) {
              try {
                await clearEmbeddingCache();
                alert('Cache penyematan telah dibersihkan. Worker akan membangun kembali indeks semantik secara inkremental.');
                window.dispatchEvent(new Event('semantic_cache_cleared'));
              } catch (err) {
                console.error('Failed to clear embedding cache', err);
                alert('Gagal membersihkan cache penyematan.');
              }
            }
          }}
          className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 font-medium text-sm transition-colors shadow-sm"
        >
          <RefreshCcw size={16} />
          Bersihkan Cache Penyematan (Clear Vector Cache)
        </button>
      </div>
    </section>
  );
}
