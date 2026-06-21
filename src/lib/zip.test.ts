import { describe, it, expect } from 'vitest';
import { crc32, createZip } from './zip';

const enc = new TextEncoder();

describe('crc32', () => {
  it('cocok dengan nilai rujukan yang diketahui', () => {
    expect(crc32(enc.encode(''))).toBe(0);
    // CRC-32 standar untuk "123456789"
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('createZip', () => {
  it('menulis signature lokal & EOCD serta menghitung entri', () => {
    const zip = createZip([
      { name: 'mimetype', data: enc.encode('application/epub+zip') },
      { name: 'a.txt', data: enc.encode('halo') },
    ]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // Local file header signature di awal
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // EOCD signature 22 byte dari akhir
    const eocd = zip.byteLength - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    // Jumlah entri = 2
    expect(view.getUint16(eocd + 10, true)).toBe(2);
  });

  it('entri pertama benar-benar mimetype stored', () => {
    const zip = createZip([{ name: 'mimetype', data: enc.encode('application/epub+zip') }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint16(8, true)).toBe(0); // metode kompresi = 0 (stored)
    const nameLen = view.getUint16(26, true);
    const name = new TextDecoder().decode(zip.slice(30, 30 + nameLen));
    expect(name).toBe('mimetype');
  });
});
