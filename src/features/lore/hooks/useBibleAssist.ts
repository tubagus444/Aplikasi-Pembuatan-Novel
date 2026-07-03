import { useState, useRef, useCallback } from 'react';
import { suggestBibleField, cancelAI, AIError } from '@/src/services/ai';
import type { BibleAssistField, BibleContextInput } from '@/src/services/ai';

interface AssistState {
  /** Bidang yang sedang/terakhir diminta; null saat idle. */
  field: BibleAssistField | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  suggestion: string;
  error: string;
}

const IDLE: AssistState = { field: null, status: 'idle', suggestion: '', error: '' };

/**
 * State ringan untuk AI-assist Story Bible: satu saran aktif pada satu waktu.
 * Panel memutuskan apa yang dilakukan dengan `suggestion` (ganti/tambah/batal).
 * Bisa dibatalkan; respons basi (dari permintaan yang sudah diganti) diabaikan
 * lewat penjaga `reqId`.
 */
export function useBibleAssist() {
  const [assist, setAssist] = useState<AssistState>(IDLE);
  const reqId = useRef(0);

  const generate = useCallback(async (field: BibleAssistField, ctx: BibleContextInput) => {
    const id = ++reqId.current;
    setAssist({ field, status: 'loading', suggestion: '', error: '' });
    try {
      const text = await suggestBibleField(field, ctx);
      if (id !== reqId.current) return; // dibatalkan / diganti permintaan lain
      if (!text.trim()) {
        setAssist({ field, status: 'error', suggestion: '', error: 'AI tidak mengembalikan teks. Coba lagi.' });
        return;
      }
      setAssist({ field, status: 'ready', suggestion: text, error: '' });
    } catch (e: any) {
      if (id !== reqId.current) return;
      if (e?.name === 'AbortError') { setAssist(IDLE); return; }
      const msg = e instanceof AIError ? e.message : 'Gagal menghasilkan saran AI. Periksa koneksi/kunci API.';
      setAssist({ field, status: 'error', suggestion: '', error: msg });
    }
  }, []);

  /** Tutup kotak saran tanpa membatalkan panggilan jaringan (mis. setelah diterima). */
  const clear = useCallback(() => {
    reqId.current++;
    setAssist(IDLE);
  }, []);

  /** Batalkan panggilan yang sedang berjalan dan tutup kotak saran. */
  const cancel = useCallback(() => {
    reqId.current++;
    cancelAI('bible-assist');
    setAssist(IDLE);
  }, []);

  return { assist, generate, clear, cancel };
}
