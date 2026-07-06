/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pemrosesan gambar peta untuk Atlas Dunia — validasi tipe/ukuran, baca dimensi
 * asli, dan auto-resize sisi terpanjang ke ~4000px lewat <canvas> browser.
 * NOL dependensi & NOL jaringan (local-first, RENCANA-ATLAS-DUNIA.md §5).
 *
 * SVG & PDF/GIS DITOLAK (risiko script + koordinat non-raster). Pesan error
 * berbahasa Indonesia, konsisten gaya UI aplikasi.
 */

import { useState, useCallback } from 'react';

/** Tipe MIME gambar yang diterima. SVG sengaja TIDAK termasuk. */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** Batas lunak ukuran file mentah. */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
/** Sisi terpanjang maksimum setelah resize. */
const MAX_DIMENSION = 4000;

export interface ProcessedMapImage {
  blob: Blob;
  width: number;
  height: number;
  /** true bila gambar diperkecil dari dimensi aslinya. */
  resized: boolean;
}

/** Error dengan pesan siap-tampil (bahasa Indonesia). */
export class MapImageError extends Error {}

/** Muat file gambar ke <img> untuk membaca dimensi & menggambar ulang. */
function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new MapImageError('Gambar gagal dibaca — file mungkin rusak atau tak didukung.'));
    img.src = objectUrl;
  });
}

/**
 * Validasi + (bila perlu) perkecil gambar. Melempar `MapImageError` berpesan
 * Indonesia bila ditolak. Aman dipanggil dari event handler.
 */
export async function processMapImage(file: File): Promise<ProcessedMapImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    if (file.type === 'image/svg+xml') {
      throw new MapImageError('SVG belum didukung. Gunakan PNG, JPG, WEBP, atau GIF.');
    }
    throw new MapImageError('Format tidak didukung. Gunakan gambar PNG, JPG, WEBP, atau GIF.');
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new MapImageError(`Ukuran gambar ${mb} MB melebihi batas 5 MB. Perkecil dulu gambarnya.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) {
      throw new MapImageError('Dimensi gambar tak terbaca.');
    }

    const longest = Math.max(srcW, srcH);
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;

    // Tak perlu resize: simpan blob asli apa adanya (hemat, tanpa re-encode).
    if (scale === 1) {
      return { blob: file, width: srcW, height: srcH, resized: false };
    }

    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new MapImageError('Kanvas gambar tak tersedia di peramban ini.');
    ctx.drawImage(img, 0, 0, outW, outH);

    // GIF kehilangan animasi saat di-canvas → keluarkan PNG; sisanya WEBP (lebih kecil).
    const outType = file.type === 'image/gif' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, 0.9),
    );
    if (!blob) throw new MapImageError('Gagal mengecilkan gambar.');
    return { blob, width: outW, height: outH, resized: true };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Hook tipis: bungkus `processMapImage` dengan state loading/error. */
export function useMapImageUpload() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(async (file: File): Promise<ProcessedMapImage | null> => {
    setProcessing(true);
    setError(null);
    try {
      return await processMapImage(file);
    } catch (e) {
      setError(e instanceof MapImageError ? e.message : 'Gagal memproses gambar.');
      return null;
    } finally {
      setProcessing(false);
    }
  }, []);

  return { process, processing, error, clearError: () => setError(null) };
}
