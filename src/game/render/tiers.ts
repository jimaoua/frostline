import { easeOutBack } from '../core/math';
import { drawItem } from './items';
import { C } from './palette';
import { ball, ellipse, fillRR, poly, prism, rel, vGrad } from './shapes';

type Ctx = CanvasRenderingContext2D;

/**
 * Visible station levels (Lv2–4). Each level adds its own piece to the
 * station, kept beside or behind it so the working parts stay readable.
 * A piece pops in with a bounce right after its level is bought.
 */

/** Scale for the newest piece: grows in over half a second after the upgrade. */
function grow(time: number, at: number): number {
  const t = (time - at) / 0.5;
  if (t < 0 || t >= 1) return 1;
  return Math.max(0.01, easeOutBack(t));
}

/** Draw `fn` scaled from its own base point `(x, y)` (screen offsets inside the station). */
function piece(ctx: Ctx, x: number, y: number, k: number, fn: () => void): void {
  if (k === 1) {
    fn();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

/** Scale for the piece of level `lv` when the station is at `level`. */
const k = (lv: number, level: number, time: number, at: number) => (lv === level ? grow(time, at) : 1);

/* ---------------- Grill ---------------- */

/** Behind the grill: Lv2 stone flue with smoke, Lv4 crystal-blue flame vents. */
export function grillBack(ctx: Ctx, level: number, time: number, at: number): void {
  if (level >= 2) {
    const b = rel(0.35, -0.55);
    piece(ctx, b.x, b.y, k(2, level, time, at), () => {
      prism(ctx, 0.35, -0.55, 0.3, 0.26, 40, 0, { left: vGrad(ctx, -40, 0, '#a7b1bd', '#6d7887'), right: vGrad(ctx, -40, 0, '#86919f', '#535e6c'), top: '#2a2a30' });
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let z = 8; z < 38; z += 9) {
        const p = rel(0.35, -0.42, z);
        ctx.fillRect(p.x - 4, p.y, 6, 2);
      }
      const top = rel(0.35, -0.55, 44);
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.4 + i / 3) % 1;
        ctx.globalAlpha = (1 - t) * 0.5;
        ball(ctx, top.x + Math.sin(time + i) * 2 + t * 6, top.y - t * 26, 3 + t * 6, 2.6 + t * 5, '#f4f1ec', '#d6d0c8', '#aaa29a');
      }
      ctx.globalAlpha = 1;
    });
  }
}

/** On the grill: Lv3 a gold rim, Lv4 a rotisserie spit with a turning fish and blue sparks. */
export function grillFront(ctx: Ctx, level: number, time: number, at: number): void {
  if (level >= 3) {
    piece(ctx, 0, -16, k(3, level, time, at), () => {
      const a = rel(-0.62, 0.38, 16.5);
      const b = rel(0.62, 0.38, 16.5);
      const c = rel(0.62, -0.38, 16.5);
      ctx.strokeStyle = '#f2b928';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,243,176,0.9)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // A little golden fish plate on the front.
      const s = rel(0, 0.38, 8);
      fillRR(ctx, s.x - 7, s.y - 4, 14, 8, 2, '#d4920f');
      drawItem(ctx, 'meal', s.x, s.y, 0.55);
    });
  }
  if (level >= 4) {
    const l = rel(-0.6, 0, 18);
    const r = rel(0.6, 0, 18);
    piece(ctx, (l.x + r.x) / 2, l.y, k(4, level, time, at), () => {
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(l.x - 1, l.y - 16, 2.4, 16);
      ctx.fillRect(r.x - 1, r.y - 16, 2.4, 16);
      ctx.strokeStyle = '#c9ced6';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y - 14);
      ctx.lineTo(r.x, r.y - 14);
      ctx.stroke();
      ctx.save();
      const m = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 - 14 };
      ctx.translate(m.x, m.y);
      ctx.scale(1, 0.8 + 0.2 * Math.cos(time * 3));
      drawItem(ctx, 'meal', 0, 0, 0.9);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const t = (time * 1.3 + i / 3) % 1;
        ellipse(ctx, m.x - 8 + i * 8, m.y + 10 - t * 16, 1.4, 1.4, `rgba(150,230,255,${1 - t})`);
      }
      ctx.globalCompositeOperation = 'source-over';
    });
  }
}

/* ---------------- Serving counter ---------------- */

/** Beside the counter: Lv2 chalk menu board, Lv3 bunting and a gold lantern, Lv4 a bench and table for guests. */
export function counterTier(ctx: Ctx, level: number, time: number, at: number, night: number): void {
  if (level >= 2) {
    const p = rel(-0.85, 0.35);
    piece(ctx, p.x, p.y, k(2, level, time, at), () => {
      // A-frame board.
      poly(ctx, [{ x: p.x - 7, y: p.y }, { x: p.x - 4, y: p.y - 22 }, { x: p.x + 4, y: p.y - 22 }, { x: p.x + 7, y: p.y }], '#6b3f22', '#3f2412', 1);
      fillRR(ctx, p.x - 5, p.y - 20, 10, 15, 1.5, '#2c3a34');
      drawItem(ctx, 'meal', p.x, p.y - 15, 0.5);
      ctx.fillStyle = '#f4f1ec';
      ctx.font = '900 6px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y - 7);
    });
  }
  if (level >= 3) {
    piece(ctx, 0, -44, k(3, level, time, at), () => {
      const a = rel(-0.62, 0.42, 44);
      const b = rel(0.62, 0.42, 44);
      const cols = ['#e34b4b', '#f2b928', '#3c88cf', '#4fbf6a', '#f2b928'];
      for (let i = 0; i < 5; i++) {
        const t0 = i / 5;
        const t1 = (i + 1) / 5;
        const x0 = a.x + (b.x - a.x) * t0;
        const y0 = a.y + (b.y - a.y) * t0 + Math.sin(t0 * Math.PI) * 5;
        const x1 = a.x + (b.x - a.x) * t1;
        const y1 = a.y + (b.y - a.y) * t1 + Math.sin(t1 * Math.PI) * 5;
        const sway = Math.sin(time * 2.4 + i) * 0.8;
        poly(ctx, [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: (x0 + x1) / 2 + sway, y: (y0 + y1) / 2 + 7 }], cols[i]);
      }
      const l = rel(-0.5, 0.32, 38);
      ball(ctx, l.x - 3, l.y + 4, 3.4, 4, '#fff3c4', night > 0.2 ? '#ffd77a' : '#f2b928', '#b07a0c');
    });
  }
  if (level >= 4) {
    const p = rel(0.95, 0.75);
    piece(ctx, p.x, p.y, k(4, level, time, at), () => {
      // Small table with a meal, and a bench.
      prism(ctx, 0.95, 0.75, 0.42, 0.42, 9, 0, { left: C.wood, right: C.woodDark, top: '#e2a96f' });
      const t = rel(0.95, 0.75, 9);
      drawItem(ctx, 'meal', t.x, t.y - 2, 0.7);
      prism(ctx, 1.3, 1.05, 0.5, 0.18, 5, 0, { left: C.wood, right: C.woodDark, top: '#d99a5f' });
    });
  }
}

/* ---------------- Fishing hole ---------------- */

/** Around the fishing hole: Lv2 a rod rack, Lv3 a tackle box and a full bucket, Lv4 a fish-drying rack. */
export function pondTier(ctx: Ctx, sx: number, sy: number, level: number, time: number, at: number): void {
  if (level >= 2) {
    const p = rel(0.95, -0.55);
    piece(ctx, sx + p.x, sy + p.y, k(2, level, time, at), () => {
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + p.x - 4 + i * 6, sy + p.y);
        ctx.lineTo(sx + p.x + 2 + i * 6, sy + p.y - 30);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx + p.x + 2, sy + p.y - 30);
      ctx.quadraticCurveTo(sx + p.x + 10, sy + p.y - 22, sx + p.x + 9, sy + p.y - 8);
      ctx.stroke();
    });
  }
  if (level >= 3) {
    const p = rel(-0.95, 0.55);
    piece(ctx, sx + p.x, sy + p.y, k(3, level, time, at), () => {
      // Tackle box with the lid up, and a bucket brimming with fish.
      ctx.save();
      ctx.translate(sx, sy);
      prism(ctx, -0.95, 0.55, 0.34, 0.22, 7, 0, { left: '#e0702f', right: '#b0521e', top: '#f29a5a' });
      const lid = rel(-0.95, 0.44, 7);
      poly(ctx, [{ x: lid.x - 9, y: lid.y }, { x: lid.x + 6, y: lid.y - 4 }, { x: lid.x + 6, y: lid.y - 12 }, { x: lid.x - 9, y: lid.y - 8 }], '#f29a5a', '#8a3c14', 0.8);
      ctx.restore();
      const bk = rel(-0.55, 0.8);
      ball(ctx, sx + bk.x, sy + bk.y - 5, 5, 5.5, '#dfe8f0', '#9fb3c6', '#6a8299');
      drawItem(ctx, 'fish', sx + bk.x - 2, sy + bk.y - 11, 0.7);
      drawItem(ctx, 'fish', sx + bk.x + 3, sy + bk.y - 12, 0.7);
    });
  }
  if (level >= 4) {
    const p = rel(0.2, 1.0);
    piece(ctx, sx + p.x, sy + p.y, k(4, level, time, at), () => {
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx + p.x - 12, sy + p.y);
      ctx.lineTo(sx + p.x - 12, sy + p.y - 22);
      ctx.lineTo(sx + p.x + 12, sy + p.y - 26);
      ctx.lineTo(sx + p.x + 12, sy + p.y - 4);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(sx + p.x - 7 + i * 7, sy + p.y - 20 - i * 1.4);
        ctx.rotate(Math.PI / 2 + Math.sin(time * 2 + i) * 0.08);
        drawItem(ctx, 'fish', 5, 0, 0.65);
        ctx.restore();
      }
    });
  }
}

/* ---------------- Lumberjack hut ---------------- */

/** Beside the hut: Lv2 a taller log store, Lv3 a sawhorse with a saw, Lv4 a covered lean-to full of logs. */
export function lumberTier(ctx: Ctx, level: number, time: number, at: number): void {
  const W = 1.7;
  const D = 1.4;
  if (level >= 2) {
    const lp = rel(-W / 2 - 0.1, D / 2 + 0.1);
    piece(ctx, lp.x, lp.y, k(2, level, time, at), () => {
      for (let i = 5; i < 11; i++) drawItem(ctx, 'wood', lp.x + (i % 3) * 4 - 4, lp.y - 3 - Math.floor(i / 3) * 4.6, 1);
    });
  }
  if (level >= 3) {
    const p = rel(W / 2 + 0.45, -0.2);
    piece(ctx, p.x, p.y, k(3, level, time, at), () => {
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y);
      ctx.lineTo(p.x - 3, p.y - 12);
      ctx.lineTo(p.x + 3, p.y);
      ctx.moveTo(p.x + 3, p.y + 2);
      ctx.lineTo(p.x + 9, p.y - 10);
      ctx.lineTo(p.x + 15, p.y + 2);
      ctx.stroke();
      drawItem(ctx, 'wood', p.x + 3, p.y - 13, 1.1);
      // Saw blade resting on the log.
      poly(ctx, [{ x: p.x - 2, y: p.y - 19 }, { x: p.x + 12, y: p.y - 22 }, { x: p.x + 12, y: p.y - 18 }, { x: p.x - 2, y: p.y - 15 }], '#c9d2dc', '#6d7887', 0.6);
      ctx.fillStyle = C.woodDeep;
      ctx.fillRect(p.x - 6, p.y - 19, 4, 4);
    });
  }
  if (level >= 4) {
    const p = rel(-W / 2 - 0.55, -0.35);
    piece(ctx, p.x, p.y, k(4, level, time, at), () => {
      prism(ctx, -W / 2 - 0.55, -0.35, 0.5, 0.9, 2, 0, { left: C.woodDark, right: C.woodDeep, top: '#a8693c' });
      for (let i = 0; i < 9; i++) drawItem(ctx, 'wood', p.x - 6 + (i % 3) * 5, p.y - 5 - Math.floor(i / 3) * 4.4, 1);
      ctx.fillStyle = C.woodDeep;
      ctx.fillRect(p.x - 12, p.y - 26, 2, 24);
      ctx.fillRect(p.x + 10, p.y - 30, 2, 28);
      poly(ctx, [{ x: p.x - 15, y: p.y - 24 }, { x: p.x + 14, y: p.y - 32 }, { x: p.x + 16, y: p.y - 28 }, { x: p.x - 13, y: p.y - 20 }], C.roof, C.roofDark, 1);
      poly(ctx, [{ x: p.x - 15, y: p.y - 25 }, { x: p.x + 14, y: p.y - 33 }, { x: p.x + 14, y: p.y - 31 }, { x: p.x - 15, y: p.y - 23 }], '#f7fbff');
    });
  }
}

/* ---------------- Smokehouse ---------------- */

/** On the smokehouse: Lv2 a second chimney, Lv3 a second rack of salmon, Lv4 copper lanterns and a warm ember glow. */
export function smokeTier(ctx: Ctx, level: number, time: number, at: number, night: number): void {
  if (level >= 2) {
    const b = rel(0.3, 0.2, 36);
    piece(ctx, b.x, b.y, k(2, level, time, at), () => {
      prism(ctx, 0.3, 0.2, 0.24, 0.24, 20, 36, { left: '#9aa4b1', right: '#6b7584', top: '#2a2a30' });
      const top = rel(0.3, 0.2, 58);
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.35 + i / 3 + 0.2) % 1;
        ctx.globalAlpha = (1 - t) * 0.45;
        ball(ctx, top.x + Math.sin(time + i) * 3 + t * 8, top.y - t * 32, 3.4 + t * 7, 3 + t * 6, '#f4f1ec', '#d6d0c8', '#aaa29a');
      }
      ctx.globalAlpha = 1;
    });
  }
  if (level >= 3) {
    const r0 = rel(0.2, 0.95);
    piece(ctx, r0.x, r0.y, k(3, level, time, at), () => {
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r0.x - 12, r0.y);
      ctx.lineTo(r0.x - 12, r0.y - 22);
      ctx.lineTo(r0.x + 12, r0.y - 26);
      ctx.lineTo(r0.x + 12, r0.y - 4);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(r0.x - 7 + i * 7, r0.y - 20 - i * 1.4);
        ctx.rotate(Math.PI / 2 + Math.sin(time * 2 + i) * 0.06);
        drawItem(ctx, 'smoked', 5, 0, 0.6);
        ctx.restore();
      }
    });
  }
  if (level >= 4) {
    const l = rel(0.7, 0.55, 22);
    piece(ctx, l.x, l.y, k(4, level, time, at), () => {
      ball(ctx, l.x, l.y, 3.2, 3.8, '#fff3c4', night > 0.2 ? '#ffb45a' : '#d98a3a', '#8a4a1c');
      ctx.globalCompositeOperation = 'lighter';
      const g = 0.25 + 0.08 * Math.sin(time * 6);
      ellipse(ctx, l.x, l.y, 12, 10, `rgba(255,150,60,${g})`);
      ctx.globalCompositeOperation = 'source-over';
    });
  }
}

/* ---------------- Stash ---------------- */

/** On the stash deck: Lv2 crates, Lv3 a railing with a sign, Lv4 an iron-banded vault chest. */
export function stashBack(ctx: Ctx, sx: number, sy: number, level: number, time: number, at: number): void {
  if (level >= 3) {
    piece(ctx, sx, sy, k(3, level, time, at), () => {
      ctx.save();
      ctx.translate(sx, sy);
      // Railing along the back and left edges (the front stays open to walk on).
      const pts = [rel(-0.75, 0.75), rel(-0.75, -0.75), rel(0.75, -0.75)];
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 2;
      for (const z of [8, 15]) {
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y - z) : ctx.moveTo(q.x, q.y - z)));
        ctx.stroke();
      }
      ctx.fillStyle = C.woodDeep;
      for (const [x, y] of [[-0.75, 0.75], [-0.75, 0], [-0.75, -0.75], [0, -0.75], [0.75, -0.75]] as const) {
        const q = rel(x, y);
        ctx.fillRect(q.x - 1.4, q.y - 17, 2.8, 17);
      }
      // Sign on the back rail.
      const sgn = rel(0, -0.75, 20);
      fillRR(ctx, sgn.x - 14, sgn.y - 8, 28, 11, 2, '#6b3f22');
      ctx.fillStyle = '#ffe9a0';
      ctx.font = '900 7px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('STASH', sgn.x, sgn.y);
      ctx.restore();
    });
  }
  if (level >= 2) {
    const p = rel(-0.55, -0.55);
    piece(ctx, sx + p.x, sy + p.y, k(2, level, time, at), () => {
      ctx.save();
      ctx.translate(sx, sy);
      prism(ctx, -0.55, -0.55, 0.36, 0.36, 10, 0, { left: C.wood, right: C.woodDark, top: '#e2a96f' });
      prism(ctx, -0.55, -0.55, 0.3, 0.3, 8, 10, { left: C.wood, right: C.woodDark, top: '#e2a96f' });
      prism(ctx, -0.15, -0.62, 0.32, 0.32, 9, 0, { left: C.wood, right: C.woodDark, top: '#e2a96f' });
      ctx.restore();
    });
  }
  if (level >= 4) {
    const p = rel(0.5, -0.55);
    piece(ctx, sx + p.x, sy + p.y, k(4, level, time, at), () => {
      ctx.save();
      ctx.translate(sx, sy);
      prism(ctx, 0.5, -0.55, 0.42, 0.32, 12, 0, { left: '#6b4a32', right: '#4e3322', top: '#8a6040' });
      ctx.strokeStyle = '#3a3a44';
      ctx.lineWidth = 1.6;
      for (const z of [3, 9]) {
        const a = rel(0.29, -0.39, z);
        const b = rel(0.71, -0.39, z);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const lock = rel(0.5, -0.39, 7);
      ellipse(ctx, lock.x, lock.y, 1.6, 1.8, '#f2b928');
      ctx.restore();
    });
  }
}
