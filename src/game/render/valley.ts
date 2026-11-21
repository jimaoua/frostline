import { toScreen } from '../core/iso';
import { hash2 } from '../core/math';
import type { Deer } from '../core/types';
import { MEADOWS, MEADOW_R, RIVER } from '../world/layout';
import { ellipse, onGround, softShadow } from './shapes';

type Ctx = CanvasRenderingContext2D;

/*
 * Pine Valley ground details: the frozen river that winds across the south of
 * the map and the two meadows where the deer graze. Both are flat shapes on
 * the snow, drawn each frame as a handful of paths (no per-tile work).
 */

/** River centre line in world space, sampled along u = x - y. */
function riverPoints(side: number, extra: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let u = -46; u <= 46; u += 2) {
    const off = -0.35 * Math.sin(u * 0.22) + side * (RIVER.half + extra) * (1 + 0.12 * Math.sin(u * 0.5 + 1.3));
    const s = RIVER.c + off * Math.SQRT2;
    pts.push({ x: (s + u) / 2, y: (s - u) / 2 });
  }
  return pts;
}

let riverCache: { bank: Path2D; ice: Path2D; deep: Path2D; cracks: Path2D } | null = null;

function band(extra: number): Path2D {
  const a = riverPoints(-1, extra);
  const b = riverPoints(1, extra).reverse();
  const path = new Path2D();
  [...a, ...b].forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
  return path;
}

function river() {
  if (riverCache) return riverCache;
  const cracks = new Path2D();
  for (let u = -44; u <= 44; u += 3.4) {
    const s = RIVER.c - 0.35 * Math.SQRT2 * Math.sin(u * 0.22);
    const x = (s + u) / 2;
    const y = (s - u) / 2;
    const h = hash2(Math.round(u * 10), 3, 5) - 0.5;
    cracks.moveTo(x - 0.4, y + 0.2 + h * 0.3);
    cracks.lineTo(x + 0.1, y - 0.1);
    cracks.lineTo(x + 0.5 + h * 0.3, y + 0.35);
  }
  riverCache = { bank: band(0.35), ice: band(0), deep: band(-0.55), cracks };
  return riverCache;
}

export function drawValleyGround(ctx: Ctx, time: number): void {
  const o = toScreen(0, 0);
  onGround(ctx, o.x, o.y, () => {
    // Meadows: pale grass poking through thin snow.
    for (const m of MEADOWS) {
      const g = ctx.createRadialGradient(m.x, m.y, 0.2, m.x, m.y, MEADOW_R + 0.6);
      g.addColorStop(0, 'rgba(196,206,150,0.55)');
      g.addColorStop(0.7, 'rgba(206,214,170,0.35)');
      g.addColorStop(1, 'rgba(230,236,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, MEADOW_R + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const r = river();
    ctx.fillStyle = '#ffffff';
    ctx.fill(r.bank);
    ctx.fillStyle = '#bfe2f4';
    ctx.fill(r.ice);
    ctx.strokeStyle = 'rgba(110,160,200,0.55)';
    ctx.lineWidth = 0.05;
    ctx.stroke(r.ice);
    ctx.globalAlpha = 0.28 + Math.sin(time * 0.6) * 0.03;
    ctx.fillStyle = '#5f9fcb';
    ctx.fill(r.deep);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.04;
    ctx.stroke(r.cracks);
  });
  // Grass tufts in the meadows (screen space, so they stand upright).
  for (const m of MEADOWS) {
    for (let i = 0; i < 26; i++) {
      const a = hash2(i, Math.round(m.x), 7) * Math.PI * 2;
      const d = Math.sqrt(hash2(i, Math.round(m.y), 9)) * MEADOW_R;
      const s = toScreen(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d);
      const sway = Math.sin(time * 1.6 + i) * 0.8;
      ctx.strokeStyle = i % 3 ? '#a7b06a' : '#c4b57a';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const dx of [-2, 0, 2]) {
        ctx.moveTo(s.x + dx, s.y);
        ctx.lineTo(s.x + dx * 1.6 + sway, s.y - 5 - Math.abs(dx));
      }
      ctx.stroke();
    }
  }
}

/** A deer: brown body, white tail, antlers; leg cycle by speed; tips over when brought down. */
export function drawDeer(ctx: Ctx, sx: number, sy: number, d: Deer, time: number): void {
  const vs = toScreen(Math.cos(d.facing), Math.sin(d.facing));
  const flip = vs.x >= 0 ? 1 : -1;
  const speed = Math.hypot(d.vel.x, d.vel.y);
  const dead = d.state === 'dead';
  const fade = dead ? Math.max(0, 1 - Math.max(0, -d.t - 0.6) / 0.8) : 1;
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(sx, sy);
  softShadow(ctx, 0, 1, 30, 10, 0.25);
  ctx.scale(flip, 1);
  if (dead) {
    const k = Math.min(1, -d.t / 0.25);
    ctx.translate(0, -4 * k);
    ctx.rotate(k * 1.35);
  }
  const phase = time * (4 + speed * 3.2) + d.id;
  const stride = Math.min(1, speed / 2) * 5;
  const bob = speed > 0.2 ? Math.abs(Math.sin(phase)) * -2.2 : 0;
  const hurt = d.hurtT > 0;
  const body = hurt ? '#e09a7a' : d.state === 'tired' ? '#a7744c' : '#b07a4e';
  const dark = '#6e4528';
  // Legs.
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const legs: [number, number][] = [
    [-7, 0],
    [-4, Math.PI],
    [6, Math.PI],
    [9, 0],
  ];
  ctx.beginPath();
  for (const [lx, ph] of legs) {
    const sw = Math.sin(phase + ph) * stride;
    ctx.moveTo(lx, -12 + bob);
    ctx.lineTo(lx + sw, -1);
  }
  ctx.stroke();
  // Body and neck.
  ellipse(ctx, 0, -15 + bob, 12, 6.2, body);
  ellipse(ctx, -1, -12.6 + bob, 9, 2.6, '#e8d3b4');
  // Tail flag (white, up when running).
  ellipse(ctx, -11.5, -17 + bob - (d.state === 'flee' ? 2.5 : 0), 2.4, 2.8, '#ffffff');
  const grazing = d.state === 'graze' && speed < 0.1 && Math.sin(time * 0.7 + d.id) > 0.2;
  const hx = 12;
  const hy = grazing ? -6 : -26 + bob;
  ctx.strokeStyle = body;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(8, -17 + bob);
  ctx.lineTo(hx - 1, hy + 3);
  ctx.stroke();
  ellipse(ctx, hx + 1.5, hy, 4.6, 3.2, body);
  ellipse(ctx, hx + 5.2, hy + 1, 1.4, 1.2, '#2a1a10');
  ellipse(ctx, hx + 1.8, hy - 0.8, 0.8, 0.8, '#1a1008');
  ellipse(ctx, hx - 1.6, hy - 3.2, 1.6, 2.6, '#8c5a36');
  // Antlers on the bucks.
  if (d.id % 2 === 0) {
    ctx.strokeStyle = '#efe2c8';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 2.5);
    ctx.lineTo(hx - 3, hy - 10);
    ctx.moveTo(hx - 1.6, hy - 6.5);
    ctx.lineTo(hx + 1.5, hy - 9);
    ctx.moveTo(hx - 2.4, hy - 8.6);
    ctx.lineTo(hx - 5.6, hy - 11);
    ctx.stroke();
  }
  // Winded: breath puffs.
  if (d.state === 'tired' && Math.sin(time * 6 + d.id) > 0.6) ellipse(ctx, hx + 8, hy - 1, 2.2, 1.6, 'rgba(255,255,255,0.7)');
  ctx.restore();
}

/** The sled by the south gate (Frostline Camp, after the camp is safe): a soft pulse marks it. */
export function drawSledMarker(ctx: Ctx, sx: number, sy: number, time: number): void {
  const p = 0.5 + Math.sin(time * 3) * 0.5;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.strokeStyle = `rgba(255,211,77,${0.45 + p * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30 + p * 4, 15 + p * 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,211,77,0.12)';
  ctx.fill();
  ctx.font = '900 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,32,50,0.7)';
  ctx.strokeText('New refuge', 0, -46 - p * 3);
  ctx.fillStyle = '#ffd34d';
  ctx.fillText('New refuge', 0, -46 - p * 3);
  ctx.restore();
}
