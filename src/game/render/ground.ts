import { toScreen, screenToWorld } from '../core/iso';
import { hash2, valueNoise } from '../core/math';
import type { World } from '../core/types';
import { inQueueLane } from '../world/layout';
import { C } from './palette';
import { ellipse, onGround } from './shapes';

type Ctx = CanvasRenderingContext2D;

export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function diamond(ctx: Ctx, tx: number, ty: number): void {
  const a = toScreen(tx, ty);
  const b = toScreen(tx + 1, ty);
  const c = toScreen(tx + 1, ty + 1);
  const d = toScreen(tx, ty + 1);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

/** Rugged snow + packed-earth base floor. Only visible tiles are drawn. */
export function drawGround(ctx: Ctx, w: World, v: View, time: number): void {
  ctx.fillStyle = C.snow;
  ctx.fillRect(v.x0 - 2, v.y0 - 2, v.x1 - v.x0 + 4, v.y1 - v.y0 + 4);

  const corners = [screenToWorld(v.x0, v.y0), screenToWorld(v.x1, v.y0), screenToWorld(v.x0, v.y1), screenToWorld(v.x1, v.y1)];
  const tx0 = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
  const tx1 = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
  const ty0 = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
  const ty1 = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;
  const base = w.base;

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = toScreen(tx + 0.5, ty + 0.5);
      if (c.x < v.x0 - 40 || c.x > v.x1 + 40 || c.y < v.y0 - 24 || c.y > v.y1 + 24) continue;
      const h = hash2(tx, ty, 11);
      if (base.isInsideTile(tx, ty)) {
        const n = valueNoise(tx * 0.35, ty * 0.35, 3);
        const color = `hsl(28, ${46 + n * 8}%, ${61 + n * 6 + h * 2}%)`;
        diamond(ctx, tx, ty);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < 3; i++) {
          const gx = hash2(tx, ty, 20 + i) - 0.5;
          const gy = hash2(tx, ty, 30 + i) - 0.5;
          const p = toScreen(tx + 0.5 + gx * 0.8, ty + 0.5 + gy * 0.8);
          ellipse(ctx, p.x, p.y, 1.4, 0.8, C.dirtGrain);
        }
        ctx.globalAlpha = 1;
      } else {
        const n = valueNoise(tx * 0.22, ty * 0.22, 7);
        if (inQueueLane(tx + 0.5, ty + 0.5)) {
          // Trodden road: packed, slightly grey-blue snow with sled ruts.
          const color = `hsl(212, 30%, ${86 + n * 4}%)`;
          diamond(ctx, tx, ty);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
          for (let i = 0; i < 3; i++) {
            const p = toScreen(tx + hash2(tx, ty, 60 + i), ty + hash2(tx, ty, 70 + i));
            ellipse(ctx, p.x, p.y, 2.2, 1, 'rgba(120,140,170,0.35)');
          }
          continue;
        }
        if (n > 0.55 || h < 0.08) {
          const l = 95 - (n - 0.5) * 6 - (h < 0.08 ? 1.5 : 0);
          const color = `hsl(210, 48%, ${l}%)`;
          diamond(ctx, tx, ty);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (h > 0.7) {
          for (let i = 0; i < 2; i++) {
            const p = toScreen(tx + hash2(tx, ty, 40 + i), ty + hash2(tx, ty, 50 + i));
            ellipse(ctx, p.x, p.y, 1.2, 0.7, C.snowShadow);
          }
        }
        // Twinkling ice sparkles.
        if (h > 0.9) {
          const tw = Math.max(0, Math.sin(time * 2.2 + h * 40));
          if (tw > 0.6) {
            const p = toScreen(tx + hash2(tx, ty, 80), ty + hash2(tx, ty, 81));
            ctx.fillStyle = `rgba(255,255,255,${(tw - 0.6) * 2.5})`;
            ctx.fillRect(p.x - 0.6, p.y - 2.2, 1.2, 4.4);
            ctx.fillRect(p.x - 2.2, p.y - 0.6, 4.4, 1.2);
          }
        }
        // Frozen puddles and dry grass poking through.
        if (h > 0.08 && h < 0.1 && !nearBase(w, tx, ty)) {
          ellipse(ctx, c.x, c.y, 13, 5.5, '#c8e3f5');
          ellipse(ctx, c.x - 3, c.y - 1, 6, 1.4, 'rgba(255,255,255,0.8)');
        } else if (h > 0.1 && h < 0.16) {
          ctx.strokeStyle = '#b59a5e';
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const bx = c.x - 4 + i * 2.5;
            ctx.beginPath();
            ctx.moveTo(bx, c.y + 2);
            ctx.quadraticCurveTo(bx + 1, c.y - 2, bx + (i - 1.5) * 1.5, c.y - 5 - (i % 2) * 2);
            ctx.stroke();
          }
        }
        // Occasional snow drift mound, kept away from the stockade.
        if (h < 0.05 && !nearBase(w, tx, ty)) {
          ellipse(ctx, c.x + 3, c.y + 3, 16, 6, 'rgba(160,185,212,0.45)');
          ellipse(ctx, c.x, c.y, 15, 6.5, '#fbfdff');
          ellipse(ctx, c.x - 4, c.y - 2, 7, 2.6, '#ffffff');
        }
      }
    }
  }
}

function nearBase(w: World, tx: number, ty: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.base.isInsideTile(tx + dx, ty + dy)) return true;
  return false;
}

/** Inner shadow along the stockade, an outer snowbank, and gate thresholds. */
export function drawBaseEdges(ctx: Ctx, w: World): void {
  onGround(ctx, 0, 0, () => {
    for (const e of w.base.wallEdges) {
      const s = e.insideSign;
      ctx.fillStyle = 'rgba(110,60,25,0.22)';
      if (e.kind === 'h') ctx.fillRect(e.x, s > 0 ? e.y : e.y - 0.32, 1, 0.32);
      else ctx.fillRect(s > 0 ? e.x : e.x - 0.32, e.y, 0.32, 1);
      ctx.fillStyle = 'rgba(160,186,214,0.55)';
      if (e.kind === 'h') ctx.fillRect(e.x - 0.02, s > 0 ? e.y - 0.4 : e.y, 1.04, 0.4);
      else ctx.fillRect(s > 0 ? e.x - 0.4 : e.x, e.y - 0.02, 0.4, 1.04);
      ctx.fillStyle = '#fbfdff';
      if (e.kind === 'h') ctx.fillRect(e.x - 0.02, s > 0 ? e.y - 0.3 : e.y + 0.04, 1.04, 0.26);
      else ctx.fillRect(s > 0 ? e.x - 0.3 : e.x + 0.04, e.y - 0.02, 0.26, 1.04);
    }
    for (const g of w.base.gates) {
      for (const key of g.edges) {
        const [kind, xs, ys] = key.split(':');
        const x = Number(xs);
        const y = Number(ys);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? '#a8693c' : '#b9794a';
          if (kind === 'h') ctx.fillRect(x + i * 0.25, y - 0.35, 0.23, 0.7);
          else ctx.fillRect(x - 0.35, y + i * 0.25, 0.7, 0.23);
        }
      }
    }
  });
}
