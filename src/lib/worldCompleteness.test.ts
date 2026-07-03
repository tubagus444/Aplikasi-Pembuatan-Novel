/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  suggestStatus,
  effectiveStatus,
  parseTodos,
  buildCompletenessReport,
} from './worldCompleteness';
import type { CodexEntry } from '@/src/types';

function entry(p: Partial<CodexEntry>): CodexEntry {
  return {
    id: 1,
    projectId: 1,
    name: 'X',
    aliases: [],
    category: 'character',
    description: '',
    tags: [],
    ...p,
  };
}

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('suggestStatus — saran lembut', () => {
  it('deskripsi sangat pendek → stub', () => {
    expect(suggestStatus(entry({ description: words(5) }))).toBe('stub');
  });

  it('deskripsi sedang → partial', () => {
    expect(suggestStatus(entry({ description: words(30) }))).toBe('partial');
  });

  it('deskripsi panjang → solid', () => {
    expect(suggestStatus(entry({ description: words(80) }))).toBe('solid');
  });

  it('deskripsi kosong tapi ada field/secret → naik dari stub ke partial', () => {
    expect(suggestStatus(entry({ description: '', secret: 'rahasia' }))).toBe('partial');
    expect(
      suggestStatus(entry({ description: '', customFields: [{ key: 'k', label: 'K', value: 'v' }] })),
    ).toBe('partial');
  });

  it('field kosong tidak mengangkat dari stub', () => {
    expect(
      suggestStatus(entry({ description: '', customFields: [{ key: 'k', label: 'K', value: '  ' }] })),
    ).toBe('stub');
  });
});

describe('effectiveStatus — deklarasi menang atas saran', () => {
  it('worldStatus yang ditetapkan dipakai apa adanya (suggested=false)', () => {
    // Deskripsi panjang akan disarankan solid, tapi penulis menetapkan stub.
    const e = entry({ description: words(100), worldStatus: 'stub' });
    expect(effectiveStatus(e)).toEqual({ status: 'stub', suggested: false });
  });

  it('tanpa worldStatus → jatuh ke saran (suggested=true)', () => {
    const e = entry({ description: words(3) });
    expect(effectiveStatus(e)).toEqual({ status: 'stub', suggested: true });
  });
});

describe('parseTodos', () => {
  it('pecah per baris, buang kosong & bullet marker', () => {
    expect(parseTodos('- isi pemerintahan\n\n* tentukan mata uang\n  \nekonomi')).toEqual([
      'isi pemerintahan',
      'tentukan mata uang',
      'ekonomi',
    ]);
  });

  it('undefined/kosong → []', () => {
    expect(parseTodos(undefined)).toEqual([]);
    expect(parseTodos('   ')).toEqual([]);
  });
});

describe('buildCompletenessReport', () => {
  const entries: CodexEntry[] = [
    entry({ id: 1, name: 'Raja', category: 'character', description: words(100) }), // solid
    entry({ id: 2, name: 'Kerajaan Utara', category: 'location', description: words(3), todo: 'sistem pemerintahan\nmata uang' }), // stub (suggested)
    entry({ id: 3, name: 'Ordo Bayangan', category: 'other', worldStatus: 'stub', description: words(200) }), // stub (declared, overrides)
    entry({ id: 4, name: 'Pedang', category: 'item', worldStatus: 'partial', description: words(2) }), // partial (declared)
  ];

  const report = buildCompletenessReport(entries, c => c.toUpperCase());

  it('menghitung agregat total & per-status', () => {
    expect(report.total).toBe(4);
    expect(report.solid).toBe(1);
    expect(report.partial).toBe(1);
    expect(report.stub).toBe(2);
    expect(report.solidPercent).toBe(25);
  });

  it('me-resolve label kategori lewat labelOf', () => {
    const loc = report.byCategory.find(c => c.category === 'location');
    expect(loc?.label).toBe('LOCATION');
    expect(loc?.stub).toBe(1);
  });

  it('daftar stub: yang dideklarasikan sebelum yang disarankan', () => {
    expect(report.stubs.map(s => s.name)).toEqual(['Ordo Bayangan', 'Kerajaan Utara']);
    expect(report.stubs[0].suggested).toBe(false); // Ordo Bayangan dideklarasikan
    expect(report.stubs[1].suggested).toBe(true); // Kerajaan Utara disarankan
  });

  it('mengumpulkan TODO per item dari semua entri', () => {
    expect(report.todos).toEqual([
      { entryId: 2, entryName: 'Kerajaan Utara', text: 'sistem pemerintahan' },
      { entryId: 2, entryName: 'Kerajaan Utara', text: 'mata uang' },
    ]);
  });

  it('kategori terurut: paling banyak stub dulu', () => {
    // location & other sama-sama 1 stub; location total 1, other total 1 → tie-break label.
    expect(report.byCategory[0].stub).toBeGreaterThanOrEqual(report.byCategory[1].stub);
  });

  it('laporan kosong aman', () => {
    const empty = buildCompletenessReport([]);
    expect(empty).toMatchObject({ total: 0, solid: 0, partial: 0, stub: 0, solidPercent: 0 });
    expect(empty.byCategory).toEqual([]);
    expect(empty.stubs).toEqual([]);
    expect(empty.todos).toEqual([]);
  });
});
