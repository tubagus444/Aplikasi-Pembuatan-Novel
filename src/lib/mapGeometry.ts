/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Geometri Atlas Dunia — konversi & util MURNI, deterministik & nol token.
 *
 * Prinsip (RENCANA-ATLAS-DUNIA.md §7): data penanda disimpan sebagai koordinat
 * RELATIF 0–1 agar TAK terkunci ke Leaflet/resolusi gambar. Modul ini adalah satu-
 * satunya jembatan antara ruang relatif itu dan ruang koordinat Leaflet `CRS.Simple`
 * — SENGAJA tak mengimpor Leaflet (tipe `LatLngTuple` = `[number, number]` biasa),
 * sehingga ganti render engine tak menyentuh data maupun tes ini.
 *
 * Konvensi ruang:
 *  - Ruang piksel gambar: origin kiri-atas, x ke kanan, y ke BAWAH (spt raster).
 *  - Ruang relatif: rx = px/width, ry = py/height, keduanya 0..1.
 *  - Ruang Leaflet CRS.Simple: imageOverlay dipasang di bounds
 *    `[[0,0],[height,width]]` → lat 0..height, lng 0..width. Sumbu lat Leaflet naik
 *    ke ATAS layar, sedangkan y gambar turun → maka lat = height*(1-ry) (dibalik),
 *    lng = width*rx. Tuple Leaflet selalu `[lat, lng]`.
 */

import { MapPoint } from '@/src/types';

/** Tuple koordinat Leaflet `[lat, lng]` — tanpa bergantung tipe Leaflet. */
export type LatLngTuple = [number, number];

/** Batasi ke rentang [0,1]. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Titik relatif → tuple Leaflet `[lat, lng]` untuk gambar berukuran width×height. */
export function relToLatLng(p: MapPoint, width: number, height: number): LatLngTuple {
  return [height * (1 - clamp01(p.y)), width * clamp01(p.x)];
}

/** Tuple Leaflet `[lat, lng]` → titik relatif 0–1 (kebalikan `relToLatLng`). */
export function latLngToRel(latlng: LatLngTuple, width: number, height: number): MapPoint {
  const [lat, lng] = latlng;
  const w = width || 1;
  const h = height || 1;
  return { x: clamp01(lng / w), y: clamp01(1 - lat / h) };
}

/** Terjemahkan daftar titik relatif → daftar tuple Leaflet (area/route). */
export function relPathToLatLngs(points: MapPoint[], width: number, height: number): LatLngTuple[] {
  return points.map((p) => relToLatLng(p, width, height));
}

/** Titik relatif → piksel absolut pada gambar (mis. untuk ekspor/overlay non-Leaflet). */
export function relToPixel(p: MapPoint, width: number, height: number): MapPoint {
  return { x: clamp01(p.x) * width, y: clamp01(p.y) * height };
}

/** Piksel absolut → titik relatif 0–1. */
export function pixelToRel(px: MapPoint, width: number, height: number): MapPoint {
  const w = width || 1;
  const h = height || 1;
  return { x: clamp01(px.x / w), y: clamp01(px.y / h) };
}

/**
 * Sentroid (rata-rata titik) sebuah poligon/polyline relatif — dipakai untuk
 * menaruh label/ikon di tengah area. Mengembalikan `null` bila kosong.
 */
export function centroid(points: MapPoint[]): MapPoint | null {
  if (!points.length) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/**
 * Titik di dalam poligon (ray-casting), koordinat relatif. Dipakai kelak untuk
 * hit-test/analitik "adegan di wilayah ini". Poligon < 3 titik → selalu false.
 */
export function pointInPolygon(pt: MapPoint, polygon: MapPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Type guard: geometry pin (satu titik) vs area/route (array titik). */
export function isPointGeometry(g: MapPoint | MapPoint[]): g is MapPoint {
  return !Array.isArray(g);
}
