import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from './circuitBreaker';

/** Jam yang bisa dimajukan manual → uji reset tanpa timer nyata. */
function makeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('CircuitBreaker', () => {
  it('mengizinkan percobaan awal & selama di bawah ambang', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    expect(cb.check('google')).toBe(true);
    cb.recordFailure('google');
    cb.recordFailure('google');
    expect(cb.check('google')).toBe(true); // 2 < 3
  });

  it('membuka circuit setelah `threshold` kegagalan beruntun', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    cb.recordFailure('google');
    cb.recordFailure('google');
    cb.recordFailure('google');
    expect(cb.check('google')).toBe(false); // terbuka
  });

  it('tetap terbuka sampai waktu reset lewat', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    for (let i = 0; i < 3; i++) cb.recordFailure('google');
    clk.advance(29_999);
    expect(cb.check('google')).toBe(false);
    clk.advance(2); // total > 30_000 sejak failure terakhir
    expect(cb.check('google')).toBe(true); // half-open: satu trial diizinkan
  });

  it('half-open hanya mengizinkan SATU trial (blokir request paralel)', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    for (let i = 0; i < 3; i++) cb.recordFailure('google');
    clk.advance(30_001);
    expect(cb.check('google')).toBe(true);  // trial pertama
    expect(cb.check('google')).toBe(false); // paralel diblokir
  });

  it('recordSuccess menutup circuit (reset penuh)', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    for (let i = 0; i < 3; i++) cb.recordFailure('google');
    clk.advance(30_001);
    cb.check('google');       // half-open trial
    cb.recordSuccess('google');
    expect(cb.check('google')).toBe(true); // kembali normal
    expect(cb.check('google')).toBe(true);
  });

  it('kegagalan trial half-open membuka kembali & memperpanjang reset', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    for (let i = 0; i < 3; i++) cb.recordFailure('google');
    clk.advance(30_001);
    expect(cb.check('google')).toBe(true); // trial
    cb.recordFailure('google');            // trial gagal
    expect(cb.check('google')).toBe(false); // terbuka lagi
  });

  it('clearHalfOpen melepas trial menggantung (mis. dibatalkan) → trial baru diizinkan', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    for (let i = 0; i < 3; i++) cb.recordFailure('google');
    clk.advance(30_001);
    expect(cb.check('google')).toBe(true);  // trial diambil
    expect(cb.check('google')).toBe(false); // in-flight
    cb.clearHalfOpen('google');
    expect(cb.check('google')).toBe(true);  // boleh coba lagi
  });

  it('melacak provider secara terpisah', () => {
    const clk = makeClock();
    const cb = new CircuitBreaker(3, 30_000, clk.now);
    for (let i = 0; i < 3; i++) cb.recordFailure('google');
    expect(cb.check('google')).toBe(false);
    expect(cb.check('claude')).toBe(true); // tak terpengaruh
  });
});
