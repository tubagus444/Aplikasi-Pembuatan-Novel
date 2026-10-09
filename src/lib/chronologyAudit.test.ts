/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { auditChronology, ChapterRef } from './chronologyAudit';
import { calendarPreset } from './worldCalendar';
import { TimelineEvent } from '@/src/types';

const cal = calendarPreset('fantasy');

describe('auditChronology', () => {
  const chapters: ChapterRef[] = [
    { id: 1, title: 'Bab 1: Awal Petualangan', order: 1 },
    { id: 2, title: 'Bab 2: Menuju Hutan Hitam', order: 2 },
    { id: 3, title: 'Bab 3: Benteng Kuno', order: 3 },
  ];

  it('mengembalikan array kosong bila kronologi maju lurus', () => {
    const events: TimelineEvent[] = [
      {
        id: 101,
        projectId: 1,
        chapterId: 1,
        title: 'Keberangkatan',
        description: 'Meninggalkan desa',
        type: 'plot',
        order: 1,
        startDate: { era: 1, year: 812, month: 1, day: 5 },
      },
      {
        id: 102,
        projectId: 1,
        chapterId: 2,
        title: 'Masuk Hutan',
        description: 'Tiba di perbatasan hutan',
        type: 'plot',
        order: 2,
        startDate: { era: 1, year: 812, month: 1, day: 10 },
      },
      {
        id: 103,
        projectId: 1,
        chapterId: 3,
        title: 'Serangan Pertama',
        description: 'Tiba di benteng',
        type: 'plot',
        order: 3,
        startDate: { era: 1, year: 812, month: 1, day: 15 },
      },
    ];

    const anomalies = auditChronology(chapters, events, cal);
    expect(anomalies).toEqual([]);
  });

  it('mendeteksi tanggal mundur antar-bab (retrograde-chapter) dengan severity high', () => {
    const events: TimelineEvent[] = [
      {
        id: 101,
        projectId: 1,
        chapterId: 1,
        title: 'Keberangkatan',
        description: 'Meninggalkan desa',
        type: 'plot',
        order: 1,
        startDate: { era: 1, year: 812, month: 2, day: 20 },
      },
      {
        id: 102,
        projectId: 1,
        chapterId: 2,
        title: 'Tiba di Pasar',
        description: 'Peristiwa belanja',
        type: 'plot',
        order: 2,
        startDate: { era: 1, year: 812, month: 1, day: 10 }, // 1 bulan lebih tua dari Bab 1!
      },
    ];

    const anomalies = auditChronology(chapters, events, cal);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('retrograde-chapter');
    expect(anomalies[0].severity).toBe('high');
    expect(anomalies[0].isFlashback).toBe(false);
    expect(anomalies[0].chapterA?.id).toBe(1);
    expect(anomalies[0].chapterB?.id).toBe(2);
    expect(anomalies[0].daysDiff).toBeLessThan(0);
  });

  it('mendeteksi kilas balik otomatis dan menurunkan severity ke low', () => {
    const events: TimelineEvent[] = [
      {
        id: 101,
        projectId: 1,
        chapterId: 1,
        title: 'Pertarungan Terbuka',
        description: '',
        type: 'plot',
        order: 1,
        startDate: { era: 1, year: 812, month: 2, day: 20 },
      },
      {
        id: 102,
        projectId: 1,
        chapterId: 2,
        title: '[Flashback] Tragedi Masa Kecil',
        description: 'Kilas balik 5 tahun lalu sebelum petualangan dimulai',
        type: 'character',
        order: 2,
        startDate: { era: 1, year: 807, month: 1, day: 1 },
      },
    ];

    const anomalies = auditChronology(chapters, events, cal);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('retrograde-chapter');
    expect(anomalies[0].severity).toBe('low');
    expect(anomalies[0].isFlashback).toBe(true);
    expect(anomalies[0].title).toContain('[Kilas Balik]');
  });

  it('mendeteksi urutan linimasa terbalik dalam bab yang sama (retrograde-same-chapter)', () => {
    const events: TimelineEvent[] = [
      {
        id: 101,
        projectId: 1,
        chapterId: 1,
        title: 'Pesta Penyambutan',
        description: '',
        type: 'plot',
        order: 1,
        startDate: { era: 1, year: 812, month: 1, day: 15 },
      },
      {
        id: 102,
        projectId: 1,
        chapterId: 1,
        title: 'Persiapan Sebelum Pesta',
        description: '',
        type: 'plot',
        order: 2, // Posisi timeline kedua, tapi tanggalnya mendahului
        startDate: { era: 1, year: 812, month: 1, day: 10 },
      },
    ];

    const anomalies = auditChronology(chapters, events, cal);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('retrograde-same-chapter');
    expect(anomalies[0].severity).toBe('medium');
    expect(anomalies[0].eventA?.id).toBe(101);
    expect(anomalies[0].eventB?.id).toBe(102);
  });

  it('mendeteksi rentang tanggal tidak valid (endDate < startDate)', () => {
    const events: TimelineEvent[] = [
      {
        id: 101,
        projectId: 1,
        chapterId: 1,
        title: 'Pengepungan Aneh',
        description: '',
        type: 'plot',
        order: 1,
        startDate: { era: 1, year: 812, month: 3, day: 20 },
        endDate: { era: 1, year: 812, month: 3, day: 10 }, // Mundur!
      },
    ];

    const anomalies = auditChronology(chapters, events, cal);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('invalid-range');
    expect(anomalies[0].severity).toBe('high');
  });

  it('menangani peristiwa lintas-era dengan aman', () => {
    const events: TimelineEvent[] = [
      {
        id: 101,
        projectId: 1,
        chapterId: 1,
        title: 'Akhir Era Lama',
        description: '',
        type: 'world',
        order: 1,
        startDate: { era: 1, year: 812, month: 1, day: 1 },
      },
      {
        id: 102,
        projectId: 1,
        chapterId: 2,
        title: 'Masa Lampau Jauh',
        description: '',
        type: 'world',
        order: 2,
        startDate: { era: 0, year: 50, month: 1, day: 1 }, // Era 0 < Era 1
      },
    ];

    const anomalies = auditChronology(chapters, events, cal);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('retrograde-chapter');
    expect(anomalies[0].daysDiff).toBeNull(); // Lintas-era daysDiff adalah null
  });
});
