import { FOOTPRINT_LIFE } from '../core/constants';
import { toScreen } from '../core/iso';
import { easeInOut, easeOutBack } from '../core/math';
import type { Vec, World } from '../core/types';
import { drawItem } from './items';
import { ellipse, onGround } from './shapes';
import type { View } from './ground';

type Ctx = CanvasRenderingContext2D;

const inView = (p: Vec, v: View, m = 60) => p.x > v.x0 - m && p.x < v.x1 + m && p.y > v.y0 - m && p.y < v.y1 + m;

/** Footprints are painted onto the ground plane so they foreshorten correctly. */
export function drawFootprints(ctx: Ctx, w: World, v: View): void {
  for (const f of w.footprints) {
    const s = toScreen(f.x, f.y);
    if (!inView(s, v, 20)) continue;
    const fade = 1 - f.age / FOOTPRINT_LIFE;
    const inside = w.base.isInside(f.x, f.y);
    ctx.globalAlpha = fade * (inside ? 0.28 : 0.55);
    ctx.fillStyle = inside ? '#8e5d35' : '#93a9c4';
    const k = f.big ? 1.8 : 1;
    onGround(ctx, s.x, s.y, () => {
      ctx.rotate(f.angle);
      ctx.scale(k, k);
      ctx.beginPath();
      if (f.paw) {
        ctx.ellipse(0, 0, 0.05, 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const a of [-0.6, 0, 0.6]) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.02, 0.02, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.ellipse(0, 0, 0.085, 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  ctx.globalAlpha = 1;
}

/** Items flying between places: arc, spin, and a little pop as they land. */
export function drawFlyers(ctx: Ctx, w: World): void {
  for (const f of w.flyers) {
    const to = typeof f.to === 'function' ? f.to() : f.to;
    const t = Math.min(1, f.t / f.dur);
    const e = easeInOut(t);
    const x = f.from.x + (to.x - f.from.x) * e;
    const y = f.from.y + (to.y - f.from.y) * e;
    const z = f.fromZ + (f.toZ - f.fromZ) * e + Math.sin(Math.PI * e) * f.arc;
    const s = toScreen(x, y, z);
    const scale = 0.85 + Math.sin(Math.PI * t) * 0.35;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.sin(t * Math.PI) * f.spin * 0.06);
    drawItem(ctx, f.kind, 0, 0, scale);
    ctx.restore();
  }
}

export function drawArrows(ctx: Ctx, w: World): void {
  ctx.lineCap = 'round';
  for (const a of w.arrows) {
    const s = toScreen(a.pos.x, a.pos.y, a.z);
    const dx = Math.cos(a.angle) * 8;
    const dy = Math.sin(a.angle) * 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x - dx * 2, s.y - dy * 2);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.strokeStyle = '#5a3420';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(s.x - dx, s.y - dy);
    ctx.lineTo(s.x + dx, s.y + dy);
    ctx.stroke();
    ellipse(ctx, s.x + dx, s.y + dy, 1.8, 1.8, '#d0d8e0');
  }
  ctx.lineCap = 'butt';
}

export function drawParticles(ctx: Ctx, w: World): void {
  for (const p of w.particles) {
    const s = toScreen(p.x, p.y, p.z);
    const k = Math.max(0, p.life / p.maxLife);
    switch (p.kind) {
      case 'puff':
        ctx.globalAlpha = k * 0.8;
        ellipse(ctx, s.x, s.y, p.size * (1.6 - k * 0.6), p.size * (1.6 - k * 0.6) * 0.8, p.color);
        break;
      case 'smoke':
      case 'steam':
      case 'breath': {
        const grow = 1 + (1 - k) * (p.kind === 'smoke' ? 2.2 : 1.6);
        ctx.globalAlpha = k * (p.kind === 'smoke' ? 0.45 : p.kind === 'breath' ? 0.55 : 0.5);
        ellipse(ctx, s.x, s.y, p.size * grow, p.size * grow * 0.85, p.color);
        break;
      }
      case 'wisp':
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.35;
        ellipse(ctx, s.x, s.y, p.size * 2.2, p.size * 0.45, p.color);
        break;
      case 'chip':
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(s.x - p.size / 2, s.y - p.size / 2, p.size, p.size * 0.7);
        break;
      case 'confetti':
        ctx.globalAlpha = Math.min(1, k * 2.5);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.spin * (1 - k) * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6 * Math.abs(Math.cos(p.life * 9)));
        ctx.restore();
        break;
      case 'ring':
        onGround(ctx, s.x, s.y, () => {
          const r = p.size * easeOutBack(1 - k) * 0.9 + 0.05;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.01, r), 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = k * 0.9;
          ctx.lineWidth = 0.12 * k + 0.02;
          ctx.stroke();
        });
        break;
      case 'spark':
      case 'ember':
        ctx.globalAlpha = k;
        ellipse(ctx, s.x, s.y, p.size, p.size, p.color);
        break;
    }
  }
  ctx.globalAlpha = 1;
}

/** Floating "+$10", "+1", damage numbers and big announcements. */
export function drawPopups(ctx: Ctx, w: World): void {
  for (const p of w.popups) {
    const life = p.big ? 1.6 : 1.0;
    const t = p.t / life;
    const s = toScreen(p.x, p.y, p.z + t * (p.big ? 30 : 26));
    const pop = Math.min(1, easeOutBack(Math.min(1, p.t / 0.22)));
    ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(pop, pop);
    ctx.font = `900 ${p.big ? 15 : 12}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = p.big ? 5 : 4;
    ctx.strokeStyle = 'rgba(18,26,40,0.9)';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawFireGlow(ctx: Ctx, w: World, night: number): void {
  if (!w.fire.lit) return;
  const c = w.structures.campfire.pos;
  const s = toScreen(c.x, c.y, 14);
  const grow = Math.min(1, (w.time - w.fire.litAt) / 0.8);
  const r = (130 + night * 60 + Math.sin(w.time * 9) * 6 + Math.sin(w.time * 15) * 3) * grow;
  if (r <= 1) return;
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
  g.addColorStop(0, `rgba(255,170,70,${0.38 + night * 0.25})`);
  g.addColorStop(0.4, `rgba(255,140,50,${0.14 + night * 0.12})`);
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 10, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  depth: number;
}

/** Screen-space snowfall that leans with the wind and thickens in blizzards. */
export class Snowfall {
  private flakes: Flake[] = [];
  private streaks: { x: number; y: number; len: number; life: number }[] = [];

  resize(w: number, h: number): void {
    const n = Math.round((w * h) / 2600);
    this.flakes = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.8 + Math.random() * 2,
      vy: 16 + Math.random() * 28,
      sway: Math.random() * Math.PI * 2,
      depth: Math.random(),
    }));
  }

  draw(ctx: Ctx, w: number, h: number, dt: number, time: number, windX: number, windY: number, intensity: number): void {
    const active = Math.floor(this.flakes.length * (0.28 + intensity * 0.72));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < active; i++) {
      const f = this.flakes[i];
      const sp = 0.6 + f.depth * 0.8;
      f.y += (f.vy + intensity * 60) * sp * dt + windY * 30 * sp * dt;
      f.x += (Math.sin(time * 0.8 + f.sway) * 8 + windX * 90) * sp * dt;
      if (f.y > h + 4) {
        f.y = -4;
        f.x = Math.random() * w;
      }
      if (f.x < -4) f.x = w + 4;
      if (f.x > w + 4) f.x = -4;
      ctx.globalAlpha = 0.45 + f.depth * 0.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.7 + f.depth * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Wind streaks when it gusts.
    const wind = Math.hypot(windX, windY);
    if (Math.random() < dt * (wind * 6 + intensity * 20)) {
      this.streaks.push({ x: windX > 0 ? -40 : w + 40, y: Math.random() * h, len: 40 + Math.random() * 80, life: 1 });
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (const s of this.streaks) {
      s.life -= dt * 1.2;
      s.x += windX * 700 * dt;
      s.y += windY * 300 * dt + 20 * dt;
      ctx.globalAlpha = Math.sin(Math.max(0, s.life) * Math.PI) * 0.7;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.sign(windX || 1) * s.len, s.y - 4);
      ctx.stroke();
    }
    this.streaks = this.streaks.filter((s) => s.life > 0);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';

    if (intensity > 0.02) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `rgba(235,243,252,${0.42 * intensity})`);
      g.addColorStop(0.5, `rgba(225,236,248,${0.22 * intensity})`);
      g.addColorStop(1, `rgba(235,243,252,${0.42 * intensity})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
