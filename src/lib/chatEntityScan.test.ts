import { describe, it, expect } from 'vitest';
import { scanNewEntities } from '@/src/lib/chatEntityScan';

describe('scanNewEntities', () => {
  it('mendeteksi nama-diri baru yang muncul di tengah kalimat', () => {
    const text = 'Menurutku Aldric menarik, dan konflik batin Aldric bisa jadi inti cerita.';
    expect(scanNewEntities(text, [])).toContain('Aldric');
  });

  it('mengabaikan nama yang sudah ada di Codex (nama/alias)', () => {
    const text = 'Kita bahas Aldric lagi; peran Aldric penting.';
    expect(scanNewEntities(text, [{ name: 'Aldric', aliases: [] }])).toEqual([]);
    expect(scanNewEntities(text, [{ name: 'Sang Ksatria', aliases: ['Aldric'] }])).toEqual([]);
  });

  it('menembus penanda markdown (bold) di sekitar nama', () => {
    const text = 'Tokoh **Kaelen** itu misterius; banyak yang takut pada Kaelen.';
    expect(scanNewEntities(text, [])).toContain('Kaelen');
  });

  it('tidak menawarkan kata umum awal kalimat (stopword)', () => {
    const text = 'Bagaimana kalau kita ubah endingnya? Setelah itu semua berubah.';
    expect(scanNewEntities(text, [])).toEqual([]);
  });

  it('mengembalikan array kosong untuk teks kosong', () => {
    expect(scanNewEntities('', [])).toEqual([]);
    expect(scanNewEntities('   ', [])).toEqual([]);
  });

  it('membatasi jumlah usulan sesuai opsi max', () => {
    const text = 'Tokoh utama bertemu Aldric, lalu Bael, kemudian Cyra, dan akhirnya Doran di dekat Aldric, Bael, Cyra, Doran.';
    expect(scanNewEntities(text, [], { max: 2 }).length).toBeLessThanOrEqual(2);
  });
});
