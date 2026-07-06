/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kanvas peta interaktif Atlas Dunia — Leaflet MURNI (`CRS.Simple`) atas gambar
 * yang di-upload, dipasang lewat `L.imageOverlay` (nol jaringan, tak ada tile).
 * SENGAJA memakai API bawaan Leaflet untuk pan/zoom/hit-test (matang & teruji) —
 * beda dari LoreGraphPanel yang hit-test manual. Lihat RENCANA-ATLAS-DUNIA.md §2.
 *
 * Menggambar penanda buatan-sendiri di atas Leaflet: pin (klik sekali), area/rute
 * (klik-klik tambah titik, dobel-klik selesai, Esc batal). Geometri disimpan
 * relatif 0–1 via `src/lib/mapGeometry.ts` — Leaflet hanya lapisan render.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AtlasMap, MapMarker, MapPoint } from '@/src/types';
import {
  relToLatLng,
  relPathToLatLngs,
  latLngToRel,
  isPointGeometry,
} from '@/src/lib/mapGeometry';

export type DrawMode = 'pin' | 'area' | 'route' | null;

interface MapCanvasProps {
  map: AtlasMap;
  /** Penanda yang SUDAH difilter oleh pemanggil (data tetap penuh di store). */
  markers: MapMarker[];
  drawMode: DrawMode;
  selectedMarkerId?: number;
  /** Mode ubah geometri penanda terpilih (seret handle titik). */
  editing?: boolean;
  /** Warna render tiap penanda (diturunkan pemanggil dari faksi/kategori Codex). */
  colorFor: (m: MapMarker) => string;
  /** Dipanggil saat sebuah geometri baru selesai digambar. */
  onCreateGeometry: (geometry: MapPoint | MapPoint[]) => void;
  onMarkerClick: (m: MapMarker) => void;
  /** Dipanggil saat geometri penanda diubah lewat edit (persist di dragend/ubah struktur). */
  onGeometryChange?: (markerId: number, geometry: MapPoint | MapPoint[]) => void;
  /** Progres gambar area/rute (jumlah titik draft) — untuk hint UI. */
  onDraftChange?: (points: number) => void;
}

/** Handle titik (bulat = pin/vertex, kotak vs bulat hanya kosmetik). */
function vertexIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'atlas-vertex',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.35);cursor:grab"></div>`,
  });
}

/** Handle titik-tengah untuk menyisipkan vertex baru. */
function midIcon(): L.DivIcon {
  return L.divIcon({
    className: 'atlas-midpoint',
    iconSize: [11, 11],
    iconAnchor: [5.5, 5.5],
    html: `<div style="width:11px;height:11px;background:#fff;border:2px dashed #2563eb;border-radius:50%;opacity:.85;cursor:copy"></div>`,
  });
}

export default function MapCanvas({
  map,
  markers,
  drawMode,
  selectedMarkerId,
  editing,
  colorFor,
  onCreateGeometry,
  onMarkerClick,
  onGeometryChange,
  onDraftChange,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const editLayerRef = useRef<L.LayerGroup | null>(null);
  const draftPointsRef = useRef<MapPoint[]>([]);

  // Callback & data terbaru lewat ref → handler Leaflet imperatif tak jadi basi
  // tanpa memasang-ulang listener tiap render.
  const propsRef = useRef({ colorFor, onCreateGeometry, onMarkerClick, onGeometryChange, onDraftChange, drawMode, selectedMarkerId });
  propsRef.current = { colorFor, onCreateGeometry, onMarkerClick, onGeometryChange, onDraftChange, drawMode, selectedMarkerId };

  // --- Inisialisasi peta (sekali per gambar/peta) ---
  useEffect(() => {
    if (!containerRef.current) return;
    const w = map.width || 1;
    const h = map.height || 1;
    const bounds: L.LatLngBoundsLiteral = [
      [0, 0],
      [h, w],
    ];

    const leaflet = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -5,
      zoomSnap: 0.25,
      attributionControl: false,
      // Kontrol dobel-klik dikelola manual saat menggambar area/rute.
      doubleClickZoom: true,
    });
    mapRef.current = leaflet;

    const objectUrl = URL.createObjectURL(map.imageBlob);
    L.imageOverlay(objectUrl, bounds).addTo(leaflet);
    leaflet.fitBounds(bounds);
    leaflet.setMaxBounds(leaflet.getBounds().pad(0.5));

    markerLayerRef.current = L.layerGroup().addTo(leaflet);
    draftLayerRef.current = L.layerGroup().addTo(leaflet);
    editLayerRef.current = L.layerGroup().addTo(leaflet);

    return () => {
      URL.revokeObjectURL(objectUrl);
      leaflet.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      draftLayerRef.current = null;
      editLayerRef.current = null;
      draftPointsRef.current = [];
    };
  }, [map.id, map.imageBlob, map.width, map.height]);

  // --- Render penanda tersimpan ---
  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const w = map.width || 1;
    const h = map.height || 1;

    for (const m of markers) {
      // Penanda yang sedang diedit digambar di editLayer (dengan handle) — lewati di sini.
      if (editing && m.id === selectedMarkerId) continue;
      const color = propsRef.current.colorFor(m);
      const selected = m.id === selectedMarkerId;
      let shape: L.Layer | null = null;

      if (m.kind === 'pin' && isPointGeometry(m.geometry)) {
        shape = L.circleMarker(relToLatLng(m.geometry, w, h), {
          radius: selected ? 9 : 7,
          color: '#ffffff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        });
      } else if (m.kind === 'area' && Array.isArray(m.geometry)) {
        shape = L.polygon(relPathToLatLngs(m.geometry, w, h), {
          color,
          weight: selected ? 3 : 2,
          fillColor: color,
          fillOpacity: selected ? 0.4 : 0.22,
        });
      } else if (m.kind === 'route' && Array.isArray(m.geometry)) {
        shape = L.polyline(relPathToLatLngs(m.geometry, w, h), {
          color,
          weight: selected ? 5 : 3,
          opacity: 0.9,
        });
      }

      if (shape) {
        shape.on('click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as Event);
          propsRef.current.onMarkerClick(m);
        });
        if (m.title) (shape as any).bindTooltip?.(m.title, { direction: 'top' });
        shape.addTo(layer);
      }
    }
  }, [markers, selectedMarkerId, editing, map.width, map.height, map.id]);

  // --- Mode edit geometri penanda terpilih ---
  useEffect(() => {
    const leaflet = mapRef.current;
    const editLayer = editLayerRef.current;
    if (!leaflet || !editLayer) return;
    editLayer.clearLayers();

    const marker = editing && selectedMarkerId != null ? markers.find((m) => m.id === selectedMarkerId) : undefined;
    if (!marker || marker.id == null) return;

    const w = map.width || 1;
    const h = map.height || 1;
    const color = propsRef.current.colorFor(marker);
    const persist = (geom: MapPoint | MapPoint[]) => propsRef.current.onGeometryChange?.(marker.id!, geom);

    // Pin: satu handle yang bisa diseret.
    if (marker.kind === 'pin' && isPointGeometry(marker.geometry)) {
      const handle = L.marker(relToLatLng(marker.geometry, w, h), { draggable: true, icon: vertexIcon(color) });
      handle.on('dragend', () => {
        const ll = handle.getLatLng();
        persist(latLngToRel([ll.lat, ll.lng], w, h));
      });
      handle.addTo(editLayer);
      return;
    }

    // Area/rute: handle per vertex (seret), handle titik-tengah (sisip), klik-kanan (hapus).
    if (Array.isArray(marker.geometry)) {
      const isArea = marker.kind === 'area';
      const minPoints = isArea ? 3 : 2;
      const points: MapPoint[] = marker.geometry.map((p) => ({ ...p }));
      let shape: L.Polyline | L.Polygon;

      const rebuild = () => {
        editLayer.clearLayers();
        const latlngs = relPathToLatLngs(points, w, h);
        shape = (isArea
          ? L.polygon(latlngs, { color, weight: 3, fillColor: color, fillOpacity: 0.25 })
          : L.polyline(latlngs, { color, weight: 4, opacity: 0.9 })
        ).addTo(editLayer);

        // Handle titik-tengah tiap segmen (poligon: termasuk segmen penutup).
        const segCount = isArea ? points.length : points.length - 1;
        for (let i = 0; i < segCount; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const mh = L.marker(relToLatLng(mid, w, h), { icon: midIcon(), keyboard: false });
          mh.on('click', (e) => {
            L.DomEvent.stop(e as unknown as Event);
            points.splice(i + 1, 0, mid);
            persist([...points]);
            rebuild();
          });
          mh.bindTooltip('Klik untuk menambah titik', { direction: 'top' });
          mh.addTo(editLayer);
        }

        // Handle vertex (di atas titik-tengah agar mudah dipilih).
        points.forEach((p, i) => {
          const vh = L.marker(relToLatLng(p, w, h), { draggable: true, icon: vertexIcon(color), keyboard: false });
          vh.on('drag', () => {
            const ll = vh.getLatLng();
            points[i] = latLngToRel([ll.lat, ll.lng], w, h);
            shape.setLatLngs(relPathToLatLngs(points, w, h));
          });
          vh.on('dragend', () => persist([...points]));
          vh.on('contextmenu', (e) => {
            L.DomEvent.stop(e as unknown as Event);
            if (points.length > minPoints) {
              points.splice(i, 1);
              persist([...points]);
              rebuild();
            }
          });
          vh.bindTooltip('Seret memindah · klik-kanan menghapus', { direction: 'top' });
          vh.addTo(editLayer);
        });
      };

      rebuild();
    }

    return () => {
      editLayer.clearLayers();
    };
  }, [editing, selectedMarkerId, markers, map.width, map.height, map.id]);

  // --- Mode menggambar ---
  useEffect(() => {
    const leaflet = mapRef.current;
    const draftLayer = draftLayerRef.current;
    if (!leaflet || !draftLayer) return;

    const w = map.width || 1;
    const h = map.height || 1;
    draftPointsRef.current = [];
    draftLayer.clearLayers();
    propsRef.current.onDraftChange?.(0);

    if (!drawMode) {
      leaflet.getContainer().style.cursor = '';
      return;
    }
    leaflet.getContainer().style.cursor = 'crosshair';
    // Dobel-klik menutup poligon/polyline → matikan zoom-nya selama menggambar.
    if (drawMode !== 'pin') leaflet.doubleClickZoom.disable();

    const redrawDraft = () => {
      draftLayer.clearLayers();
      const pts = draftPointsRef.current;
      if (!pts.length) return;
      const latlngs = relPathToLatLngs(pts, w, h);
      for (const ll of latlngs) {
        L.circleMarker(ll, { radius: 4, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1, weight: 1 }).addTo(draftLayer);
      }
      if (pts.length >= 2) {
        if (drawMode === 'area') {
          L.polygon(latlngs, { color: '#2563eb', weight: 2, fillOpacity: 0.15, dashArray: '4 4' }).addTo(draftLayer);
        } else {
          L.polyline(latlngs, { color: '#2563eb', weight: 2, dashArray: '4 4' }).addTo(draftLayer);
        }
      }
    };

    const finishShape = () => {
      const pts = draftPointsRef.current;
      const min = drawMode === 'area' ? 3 : 2;
      if (pts.length >= min) {
        propsRef.current.onCreateGeometry([...pts]);
      }
      draftPointsRef.current = [];
      draftLayer.clearLayers();
      propsRef.current.onDraftChange?.(0);
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      const rel = latLngToRel([e.latlng.lat, e.latlng.lng], w, h);
      if (drawMode === 'pin') {
        propsRef.current.onCreateGeometry(rel);
        return;
      }
      draftPointsRef.current.push(rel);
      propsRef.current.onDraftChange?.(draftPointsRef.current.length);
      redrawDraft();
    };

    const onDblClick = (e: L.LeafletMouseEvent) => {
      if (drawMode === 'pin') return;
      L.DomEvent.stop(e as unknown as Event);
      finishShape();
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        draftPointsRef.current = [];
        draftLayer.clearLayers();
        propsRef.current.onDraftChange?.(0);
      } else if (ev.key === 'Enter') {
        finishShape();
      }
    };

    leaflet.on('click', onClick);
    leaflet.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    return () => {
      leaflet.off('click', onClick);
      leaflet.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      leaflet.doubleClickZoom.enable();
      leaflet.getContainer().style.cursor = '';
      draftLayer.clearLayers();
      draftPointsRef.current = [];
    };
  }, [drawMode, map.width, map.height, map.id]);

  return <div ref={containerRef} className="h-full w-full bg-neutral-100 dark:bg-neutral-900" />;
}
