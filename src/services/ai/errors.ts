export type AIErrorCode =
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'CIRCUIT_OPEN'
  | 'TIMEOUT'
  | 'API_ERROR';

export function classifyError(status: number, message: string): AIErrorCode {
  const msg = message.toLowerCase();
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('key not valid') || msg.includes('invalid key') || msg.includes('aiza')) return 'INVALID_KEY';
  if (status === 429) {
    return msg.includes('quota') ? 'QUOTA_EXCEEDED' : 'RATE_LIMIT';
  }
  // Beberapa provider (Groq/OpenRouter) mengembalikan 400 untuk model yang salah, bukan 404.
  if (status === 404 || msg.includes('model not found') || (msg.includes('not found') && msg.includes('model')) || (status === 400 && msg.includes('model'))) return 'MODEL_NOT_FOUND';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'NETWORK_ERROR';
  return 'API_ERROR';
}

export function getErrorMessage(code: AIErrorCode, provider: string): string {
  const p = provider.toUpperCase();
  const messages: Record<AIErrorCode, string> = {
    INVALID_KEY: `[${p}] API key tidak valid atau kedaluwarsa. Periksa di Pengaturan.`,
    RATE_LIMIT: `[${p}] Batas laju (rate limit) tercapai. Tunggu sejenak sebelum mencoba lagi.`,
    QUOTA_EXCEEDED: `[${p}] Kuota habis. Periksa tagihan/penggunaan Anda.`,
    MODEL_NOT_FOUND: `[${p}] Model tidak ditemukan. Perbarui nama model di Pengaturan.`,
    NETWORK_ERROR: `Kesalahan jaringan. Periksa koneksi Anda.`,
    EMPTY_RESPONSE: `[${p}] Respons kosong dari model (mungkin terfilter atau terpotong).`,
    CIRCUIT_OPEN: `[${p}] Koneksi terputus sementara. Mencoba penyedia cadangan.`,
    TIMEOUT: `[${p}] Permintaan kehabisan waktu (timeout).`,
    API_ERROR: `[${p}] Kesalahan tak terduga. Lihat Log Error untuk detail.`,
  };
  return messages[code] || messages.API_ERROR;
}
