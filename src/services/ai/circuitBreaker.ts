/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Circuit breaker per-provider untuk jalur AI. Diekstrak dari `index.ts` agar logika
 * inti (open / half-open / reset) bisa diuji deterministik — jam disuntik lewat `now`.
 *
 * Semantik (dipertahankan persis dari implementasi lama):
 *  - Setelah `threshold` kegagalan beruntun → circuit TERBUKA sampai `resetMs` lewat.
 *  - Saat terbuka & waktu reset lewat → izinkan SATU percobaan half-open; request lain
 *    diblokir sampai hasil trial diketahui (`halfOpenInFlight`).
 *  - `recordSuccess` menutup circuit (hapus state). `recordFailure` menaikkan hitungan
 *    & memperpanjang reset. `clearHalfOpen` melepas trial menggantung (mis. dibatalkan).
 */
export interface CircuitState {
  failures: number;
  resetTime: number;
  halfOpenInFlight?: boolean;
}

export class CircuitBreaker {
  private states = new Map<string, CircuitState>();

  constructor(
    private readonly threshold = 3,
    private readonly resetMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * `true` = boleh mencoba provider. EFEK SAMPING: saat mengizinkan trial half-open,
   * menandai `halfOpenInFlight` agar request paralel lain diblokir.
   */
  check(provider: string): boolean {
    const s = this.states.get(provider);
    if (!s) return true;
    if (s.failures >= this.threshold) {
      if (this.now() > s.resetTime) {
        if (s.halfOpenInFlight) return false;
        s.halfOpenInFlight = true;
        return true;
      }
      return false; // masih terbuka
    }
    return true;
  }

  recordSuccess(provider: string): void {
    this.states.delete(provider);
  }

  recordFailure(provider: string): void {
    const s = this.states.get(provider) || { failures: 0, resetTime: 0 };
    s.failures += 1;
    s.resetTime = this.now() + this.resetMs;
    s.halfOpenInFlight = false; // trial half-open gagal → buka kembali
    this.states.set(provider, s);
  }

  clearHalfOpen(provider: string): void {
    const s = this.states.get(provider);
    if (s) s.halfOpenInFlight = false;
  }
}
