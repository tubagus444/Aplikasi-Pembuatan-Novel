import { describe, it, expect } from 'vitest';
import { buildTimelineSummary } from '@/src/lib/timelineSummary';
import { TimelineEvent } from '@/src/types';

const ev = (p: Partial<TimelineEvent>): TimelineEvent => ({
  projectId: 1, title: 't', description: '', type: 'plot', order: 0, ...p
});

describe('buildTimelineSummary', () => {
  it('returns empty string for no events', () => {
    expect(buildTimelineSummary([], [], [])).toBe('');
  });

  it('orders by `order` then numbers entries', () => {
    const events = [
      ev({ id: 2, title: 'Kedua', order: 1 }),
      ev({ id: 1, title: 'Pertama', order: 0 })
    ];
    const out = buildTimelineSummary(events, [], []);
    expect(out).toBe('1. Pertama\n2. Kedua');
  });

  it('includes date label, chapter title, characters, and description', () => {
    const events = [ev({
      id: 1, title: 'Kael menemukan pedang', order: 0,
      eventDate: 'Hari 3', description: 'Di reruntuhan', chapterId: 10, characterIds: [100, 101]
    })];
    const out = buildTimelineSummary(
      events,
      [{ id: 10, title: 'Bab 1' }],
      [{ id: 100, name: 'Kael' }, { id: 101, name: 'Mira' }]
    );
    expect(out).toBe('1. [Hari 3] Kael menemukan pedang (Bab: Bab 1) [Tokoh: Kael, Mira] — Di reruntuhan');
  });

  it('skips unknown chapter/character ids gracefully', () => {
    const events = [ev({ id: 1, title: 'X', order: 0, chapterId: 999, characterIds: [999] })];
    const out = buildTimelineSummary(events, [], []);
    expect(out).toBe('1. X');
  });
});
