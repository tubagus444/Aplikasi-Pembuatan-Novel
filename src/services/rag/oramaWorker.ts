import { oramaStore } from './oramaStore';
import { CodexEntry } from '@/src/types';

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, retry } = e.data;

  try {
    switch (type) {
      case 'INIT_ORAMA':
        await oramaStore.init(payload.projectId);
        break;
      case 'INDEX_ENTRY':
        await oramaStore.indexEntry(payload.entry);
        break;
      case 'UPDATE_ENTRY':
        await oramaStore.updateEntry(payload.entry);
        break;
      case 'REMOVE_ENTRY':
        await oramaStore.removeEntry(payload.dexieId);
        break;
      case 'SEARCH':
        // A search doesn't strictly need to be here but useful for consistency
        const results = await oramaStore.search(payload.query, payload.limit);
        self.postMessage({ type: 'SEARCH_RESULT', id: e.data.id, result: results });
        break;
      default:
        console.warn(`[OramaWorker] Unknown message type: ${type}`);
    }
  } catch (error: any) {
    console.error(`[OramaWorker] Error handling ${type}:`, error);
    // Untuk SEARCH, WAJIB balas (dengan error) agar promise pemanggil tidak menggantung. (RG1)
    if (type === 'SEARCH') {
      self.postMessage({ type: 'SEARCH_RESULT', id: e.data.id, error: error?.message || 'Orama worker error' });
    } else {
      // RG3: mutasi (INIT/INDEX/UPDATE/REMOVE) tadinya fire-and-forget → gagal senyap &
      // indeks fallback bisa melenceng. Laporkan ke main thread (untuk retry/log), bawa
      // serta `retry` agar main bisa membatasi percobaan ulang.
      self.postMessage({ type: 'MUTATION_ERROR', op: type, payload, retry, error: error?.message || 'mutation failed' });
    }
  }
};
