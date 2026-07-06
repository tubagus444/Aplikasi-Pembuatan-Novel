/**
 * Papan Faksi (#15) — edge "mengambang" (floating) center-to-center.
 *
 * Kartu faksi ditata bebas oleh penulis (bukan simulasi fisika), jadi handle tetap
 * atas/bawah akan menggambar garis yang berbelit saat kartu bersebelahan/berpindah.
 * Floating edge menghitung titik potong garis pusat→pusat dengan tepi tiap kartu →
 * garis selalu menempel rapi apa pun posisi relatifnya. Pola standar React Flow
 * (contoh "floating edges"), disesuaikan untuk warna per-tipe + gaya declared/derived.
 */
import { getBezierPath, useInternalNode, EdgeLabelRenderer, type EdgeProps, type InternalNode, type Node, Position } from '@xyflow/react';

/** Titik potong tepi kartu `intersectionNode` oleh garis menuju pusat `targetNode`. */
function getNodeIntersection(intersectionNode: InternalNode<Node>, targetNode: InternalNode<Node>) {
  const iw = (intersectionNode.measured.width ?? 0) / 2;
  const ih = (intersectionNode.measured.height ?? 0) / 2;
  const ipos = intersectionNode.internals.positionAbsolute;
  const tpos = targetNode.internals.positionAbsolute;

  const x2 = ipos.x + iw;
  const y2 = ipos.y + ih;
  const x1 = tpos.x + (targetNode.measured.width ?? 0) / 2;
  const y1 = tpos.y + (targetNode.measured.height ?? 0) / 2;

  const xx1 = (x1 - x2) / (2 * iw) - (y1 - y2) / (2 * ih);
  const yy1 = (x1 - x2) / (2 * iw) + (y1 - y2) / (2 * ih);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = iw * (xx3 + yy3) + x2;
  const y = ih * (-xx3 + yy3) + y2;
  return { x, y };
}

/** Sisi kartu tempat titik potong berada (untuk arah kurva Bezier). */
function getEdgePosition(node: InternalNode<Node>, point: { x: number; y: number }): Position {
  const nx = node.internals.positionAbsolute.x;
  const ny = node.internals.positionAbsolute.y;
  const nw = node.measured.width ?? 0;
  const nh = node.measured.height ?? 0;
  const px = Math.round(point.x);
  const py = Math.round(point.y);
  if (px <= Math.round(nx) + 1) return Position.Left;
  if (px >= Math.round(nx + nw) - 1) return Position.Right;
  if (py <= Math.round(ny) + 1) return Position.Top;
  return Position.Bottom;
}

function getEdgeParams(source: InternalNode<Node>, target: InternalNode<Node>) {
  const sp = getNodeIntersection(source, target);
  const tp = getNodeIntersection(target, source);
  return {
    sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y,
    sourcePos: getEdgePosition(source, sp),
    targetPos: getEdgePosition(target, tp),
  };
}

export interface FactionEdgeData {
  color: string;
  kind: 'declared' | 'derived';
  label: string;
  dimmed: boolean;
  emphasis: boolean;
  [key: string]: unknown;
}

export function FloatingEdge({ id, source, target, data, markerEnd }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
    sourcePosition: sourcePos, targetPosition: targetPos,
    curvature: 0.25,
  });

  const d = data as FactionEdgeData;
  const opacity = d.dimmed ? 0.12 : d.kind === 'derived' ? 0.75 : 1;
  const width = d.emphasis ? (d.kind === 'declared' ? 3.5 : 3) : (d.kind === 'declared' ? 2.5 : 2);

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={d.color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeOpacity={opacity}
        strokeDasharray={d.kind === 'derived' ? '5 5' : undefined}
        markerEnd={markerEnd}
        className="react-flow__edge-path"
      />
      {!d.dimmed && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: d.color,
              pointerEvents: 'none',
            }}
            className="text-[10.5px] font-semibold px-1 py-0.5 rounded bg-white/85 dark:bg-slate-900/85"
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
