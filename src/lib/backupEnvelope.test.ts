import { describe, it, expect } from 'vitest';
import { assembleBackupJson } from './backupEnvelope';

describe('assembleBackupJson', () => {
  it('menghasilkan JSON yang valid & mem-parse balik ke bentuk yang benar', () => {
    const data = { projects: [{ id: 1, name: 'A' }], chapters: [] };
    const dataString = JSON.stringify(data);
    const out = assembleBackupJson({ version: 7, timestamp: 123, checksum: 'abc' }, dataString);
    const parsed = JSON.parse(out);
    expect(parsed.version).toBe(7);
    expect(parsed.timestamp).toBe(123);
    expect(parsed.checksum).toBe('abc');
    expect(parsed.data).toEqual(data);
  });

  it('byte-identik dengan JSON.stringify({ ...meta, data }) untuk key sama', () => {
    const data = { a: 1, b: [2, 3], c: { d: 'x' } };
    const dataString = JSON.stringify(data);
    const meta = { version: 7, timestamp: 999, checksum: 'deadbeef' };
    expect(assembleBackupJson(meta, dataString)).toBe(JSON.stringify({ ...meta, data }));
  });

  it('mempertahankan idempotensi checksum: stringify(parse(dataString)) === dataString', () => {
    // Kontrak yang diandalkan restore (computeChecksum atas JSON.stringify(parsedData.data)).
    const data = { projects: [{ id: 2, name: 'B', nested: { x: [1, 2] } }] };
    const dataString = JSON.stringify(data);
    const out = assembleBackupJson({ version: 7, timestamp: 1 }, dataString);
    const parsed = JSON.parse(out);
    expect(JSON.stringify(parsed.data)).toBe(dataString);
  });

  it('menghilangkan field meta yang absen (checksum undefined tak ditulis)', () => {
    const out = assembleBackupJson({ version: 7, timestamp: 5 }, '{}');
    const parsed = JSON.parse(out);
    expect('checksum' in parsed).toBe(false);
    expect(parsed.data).toEqual({});
  });

  it('menangani meta kosong', () => {
    expect(assembleBackupJson({}, '{"x":1}')).toBe('{"data":{"x":1}}');
  });
});
