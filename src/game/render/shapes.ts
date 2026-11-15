import { HALF_H, HALF_W } from '../core/constants';
import type { Vec } from '../core/types';

type Ctx = CanvasRenderingContext2D;

/** Screen offset of a world-space offset (dx, dy) at height z. */
export function rel(dx: number, dy: number, z = 0): Vec {
  return { x: (dx - dy) * HALF_W, y: (dx + dy) * HALF_H - z };
}

export function poly(ctx: Ctx, pts: Vec[], fill?: string | CanvasGradient, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Ellipse lit from the upper-left: reads as a rounded, 3D volume. */
export function ball(ctx: Ctx, x: number, y: number, rx: number, ry: number, light: string, mid: string, dark: string): void {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ellipse(ctx, x, y, rx, ry, g);
}

/** Soft contact shadow under an object. */
export function softShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(36,56,92,${alpha})`);
  g.addColorStop(0.65, `rgba(36,56,92,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(36,56,92,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string, lw = 1): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Horizontal gradient that makes a vertical shape read as a cylinder. */
export function cylGrad(ctx: Ctx, x0: number, x1: number, light: string, mid: string, dark: string): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

export function vGrad(ctx: Ctx, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

/** Run fn with the canvas mapped onto the ground plane (1 unit = 1 tile). */
export function onGround(ctx: Ctx, sx: number, sy: number, fn: () => void): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.transform(HALF_W, HALF_H, -HALF_W, HALF_H, 0, 0);
  fn();
  ctx.restore();
}

export interface FaceColors {
  top?: string | CanvasGradient;
  left: string | CanvasGradient;
  right: string | CanvasGradient;
  stroke?: string;
}

/** Axis-aligned box centred at world offset (ox, oy). Heights in world-px. */
export function prism(ctx: Ctx, ox: number, oy: number, w: number, d: number, h: number, z0: number, c: FaceColors): void {
  const x0 = ox - w / 2;
  const x1 = ox + w / 2;
  const y0 = oy - d / 2;
  const y1 = oy + d / 2;
  const z1 = z0 + h;
  poly(ctx, [rel(x0, y1, z0), rel(x1, y1, z0), rel(x1, y1, z1), rel(x0, y1, z1)], c.left, c.stroke, 0.8);
  poly(ctx, [rel(x1, y1, z0), rel(x1, y0, z0), rel(x1, y0, z1), rel(x1, y1, z1)], c.right, c.stroke, 0.8);
  if (c.top) poly(ctx, [rel(x0, y0, z1), rel(x1, y0, z1), rel(x1, y1, z1), rel(x0, y1, z1)], c.top, c.stroke, 0.8);
}

/** Log-cabin walls: stacked rounded logs with visible log ends at the corner. */
export function logWalls(ctx: Ctx, w: number, d: number, h: number, light: string, mid: string, dark: string): void {
  prism(ctx, 0, 0, w, d, h, 0, { left: mid, right: dark });
  const rows = Math.round(h / 6);
  const step = h / rows;
  for (let k = 0; k < rows; k++) {
    const z = k * step;
    // Shading band per log on both faces.
    for (const face of ['L', 'R'] as const) {
      const a = face === 'L' ? rel(-w / 2, d / 2, z) : rel(w / 2, d / 2, z);
      const b = face === 'L' ? rel(w / 2, d / 2, z) : rel(w / 2, -d / 2, z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - step * 0.85);
      ctx.lineTo(b.x, b.y - step * 0.85);
      ctx.strokeStyle = face === 'L' ? light : mid;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 0.4);
      ctx.lineTo(b.x, b.y - 0.4);
      ctx.strokeStyle = 'rgba(60,30,12,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Log ends poking out of the front corner.
    const c = rel(w / 2, d / 2, z + step / 2);
    ellipse(ctx, c.x, c.y, step * 0.55, step * 0.5, '#f0c48c');
    ellipse(ctx, c.x, c.y, step * 0.25, step * 0.22, '#c78a52');
  }
}

/** Gable roof with its ridge running along world x. */
export function gableRoof(
  ctx: Ctx,
  ox: number,
  oy: number,
  w: number,
  d: number,
  zEave: number,
  zRidge: number,
  o: number,
  c: { front: string; back: string; gable: string; snow: string; shingle?: string },
): void {
  const x0 = ox - w / 2 - o;
  const x1 = ox + w / 2 + o;
  const yb = oy - d / 2 - o;
  const yf = oy + d / 2 + o;
  poly(ctx, [rel(x0, yb, zEave), rel(x1, yb, zEave), rel(x1, oy, zRidge), rel(x0, oy, zRidge)], c.back);
  poly(ctx, [rel(ox + w / 2, oy - d / 2, zEave), rel(ox + w / 2, oy + d / 2, zEave), rel(ox + w / 2, oy, zRidge)], c.gable);
  const front = [rel(x0, yf, zEave), rel(x1, yf, zEave), rel(x1, oy, zRidge), rel(x0, oy, zRidge)];
  const g = ctx.createLinearGradient(front[3].x, front[3].y, front[0].x, front[0].y);
  g.addColorStop(0, c.front);
  g.addColorStop(1, c.back);
  poly(ctx, front, g);
  // Shingle rows.
  if (c.shingle) {
    ctx.strokeStyle = c.shingle;
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const a = rel(x0, oy + (yf - oy) * t, zRidge - (zRidge - zEave) * t);
      const b = rel(x1, oy + (yf - oy) * t, zRidge - (zRidge - zEave) * t);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  const t = 0.45;
  const ys = oy + (yf - oy) * t;
  const zs = zRidge - (zRidge - zEave) * t;
  const sn = [rel(x0, ys, zs), rel(x0 + (x1 - x0) * 0.3, ys + 0.05, zs - 2), rel(x0 + (x1 - x0) * 0.62, ys - 0.02, zs + 1), rel(x1, ys, zs), rel(x1, oy, zRidge + 2), rel(x0, oy, zRidge + 2)];
  poly(ctx, sn, c.snow);
  poly(ctx, [rel(x0, oy - 0.08, zRidge + 1), rel(x1, oy - 0.08, zRidge + 1), rel(x1, oy, zRidge + 3), rel(x0, oy, zRidge + 3)], '#ffffff');
  poly(ctx, [rel(x0, yf, zEave + 1), rel(x1, yf, zEave + 1), rel(x1, yf, zEave - 3), rel(x0, yf, zEave - 3)], c.snow);
  // Icicles.
  ctx.fillStyle = 'rgba(214,236,255,0.9)';
  for (let i = 0; i < 6; i++) {
    const p = rel(x0 + (x1 - x0) * ((i + 0.5) / 6), yf, zEave - 3);
    const len = 3 + ((i * 37) % 5);
    ctx.beginPath();
    ctx.moveTo(p.x - 1.4, p.y);
    ctx.lineTo(p.x + 1.4, p.y);
    ctx.lineTo(p.x, p.y + len);
    ctx.closePath();
    ctx.fill();
  }
}

/** Four-sided pyramid roof. */
export function pyramidRoof(
  ctx: Ctx,
  ox: number,
  oy: number,
  w: number,
  d: number,
  zBase: number,
  zApex: number,
  c: { left: string; right: string; back: string; snow: string },
): void {
  const A = rel(ox - w / 2, oy - d / 2, zBase);
  const B = rel(ox + w / 2, oy - d / 2, zBase);
  const Cc = rel(ox + w / 2, oy + d / 2, zBase);
  const D = rel(ox - w / 2, oy + d / 2, zBase);
  const P = rel(ox, oy, zApex);
  poly(ctx, [A, B, P], c.back);
  poly(ctx, [D, A, P], c.back);
  poly(ctx, [B, Cc, P], c.right);
  poly(ctx, [Cc, D, P], c.left);
  const k = 0.45;
  const lerpP = (q: Vec) => ({ x: P.x + (q.x - P.x) * k, y: P.y + (q.y - P.y) * k });
  poly(ctx, [lerpP(B), lerpP(Cc), lerpP(D), P], c.snow);
}

/** Small glowing window on a wall face; brighter at night. */
export function windowOn(ctx: Ctx, pts: Vec[], night: number): void {
  const light = night > 0.3 ? '#ffe9a6' : '#ffd77a';
  poly(ctx, pts, light, '#5a3420', 1.4);
  const cx = (pts[0].x + pts[2].x) / 2;
  const cy = (pts[0].y + pts[2].y) / 2;
  ctx.strokeStyle = '#5a3420';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  ctx.lineTo((pts[2].x + pts[3].x) / 2, (pts[2].y + pts[3].y) / 2);
  ctx.moveTo((pts[0].x + pts[3].x) / 2, (pts[0].y + pts[3].y) / 2);
  ctx.lineTo((pts[1].x + pts[2].x) / 2, (pts[1].y + pts[2].y) / 2);
  ctx.stroke();
  if (night > 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
    g.addColorStop(0, `rgba(255,200,100,${0.45 * night})`);
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 26, cy - 26, 52, 52);
    ctx.globalCompositeOperation = 'source-over';
  }
}
