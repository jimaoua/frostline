import { toScreen } from '../core/iso';
import type { ResourceNode, Smokehouse } from '../core/types';
import { LAKE } from '../world/layout';
import { drawItem } from './items';
import { C } from './palette';
import { ball, ellipse, fillRR, gableRoof, logWalls, onGround, poly, prism, rel, softShadow, vGrad, windowOn } from './shapes';
import { bumpScale, withBuild } from './structures';

type Ctx = CanvasRenderingContext2D;

/* ---------------- The frozen lake (Chapter 2) ---------------- */

/** Wobbly shoreline: a few low-frequency bumps on the ellipse. */
function shore(a: number): number {
  return 1 + Math.sin(a * 3 + 0.7) * 0.045 + Math.sin(a * 5 + 2.1) * 0.03 + Math.sin(a * 9) * 0.015;
}

/** Ice sheet with a snow bank, pressure cracks and a slow sheen. Drawn on the ground layer. */
export function drawLake(ctx: Ctx, time: number): void {
  const c = toScreen(LAKE.x, LAKE.y);
  onGround(ctx, c.x, c.y, () => {
    const outline = (k: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const r = shore(a) * k;
        const x = Math.cos(a) * LAKE.rx * r;
        const y = Math.sin(a) * LAKE.ry * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    // Snow bank.
    outline(1.06);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Ice.
    const g = ctx.createRadialGradient(-0.8, -1.6, 0.2, 0, 0, LAKE.ry);
    g.addColorStop(0, '#e8f7ff');
    g.addColorStop(0.55, '#b5def5');
    g.addColorStop(1, '#86bfe2');
    outline(1);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,160,200,0.6)';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    // Darker deep water under the middle of the ice.
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(0.2, 0.4, LAKE.rx * 0.45, LAKE.ry * 0.5, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#4f93c4';
    ctx.fill();
    ctx.globalAlpha = 1;
    // Pressure cracks.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    const cracks: [number, number][][] = [
      [[-1.9, -2.6], [-1.1, -1.7], [-0.4, -2.0], [0.5, -1.2]],
      [[0.9, 0.4], [1.6, 1.1], [1.4, 2.0], [2.0, 2.8]],
      [[-1.6, 1.4], [-0.8, 1.0], [-0.2, 1.7]],
      [[-0.2, -3.7], [0.3, -3.0], [1.1, -3.3]],
    ];
    for (const line of cracks) {
      line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    }
    ctx.stroke();
    // Sheen that drifts across the ice.
    const t = (time * 0.05) % 1;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const y = -LAKE.ry * 0.8 + ((t + i / 3) % 1) * LAKE.ry * 1.6;
      ctx.beginPath();
      ctx.ellipse(-0.6 + i * 0.5, y, 0.9, 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/** A hole in the lake ice: open water with a bobbing float, or skinned over once fished out. */
export function drawIceHole(ctx: Ctx, n: ResourceNode, sx: number, sy: number, time: number): void {
  const pop = n.popT > 0 ? Math.max(0.05, 1 - n.popT / 0.5) : 1;
  onGround(ctx, sx, sy, () => {
    ctx.scale(pop, pop);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.42, 0.36, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (n.amount > 0) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.32);
      g.addColorStop(0, '#0b2f4e');
      g.addColorStop(1, '#2a6f9e');
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.32, 0.27, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      const rip = (time * 0.55 + n.variant * 0.2) % 1;
      ctx.strokeStyle = `rgba(200,235,255,${0.65 * (1 - rip)})`;
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.06 + rip * 0.2, 0.05 + rip * 0.17, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.32, 0.27, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#d4ecfa';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(-0.2, -0.05);
      ctx.lineTo(0.05, 0.05);
      ctx.lineTo(0.18, -0.12);
      ctx.stroke();
    }
  });
  if (n.amount > 0 && pop >= 1) {
    // Red-and-white float bobbing on the water, with a few fish markers for what's left.
    const bob = Math.sin(time * 3 + n.variant) * 1.2;
    const f = { x: sx + 5, y: sy - 1 + bob };
    ball(ctx, f.x, f.y, 2.4, 2.4, '#ffffff', '#f2f2f2', '#c9ced6');
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.4, Math.PI, Math.PI * 2);
    ctx.fillStyle = '#e9493a';
    ctx.fill();
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 2.4);
    ctx.lineTo(f.x, f.y - 6);
    ctx.stroke();
  }
}

/* ---------------- Smokehouse ---------------- */

export function drawSmokehouse(ctx: Ctx, s: Smokehouse, bumpAt: number, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 62, 0.8, sx, sy, () => {
    const sq = bumpScale(bumpAt, time);
    ctx.scale(1, sq);
    softShadow(ctx, 4, 6, 58, 24, 0.32);
    const W = 1.4;
    const D = 1.1;
    logWalls(ctx, W, D, 28, '#a47a5a', '#6e4a32', '#4e3322');
    // Soot-darkened door.
    poly(ctx, [rel(-0.22, D / 2, 0), rel(0.22, D / 2, 0), rel(0.22, D / 2, 19), rel(-0.22, D / 2, 19)], vGrad(ctx, -19, 0, '#3a2a20', '#1e1410'), '#120a06', 1);
    // Ember glow through the vents while anything is smoking.
    const busy = s.slots.some((x) => x >= 0);
    const glow = busy ? 0.55 + Math.sin(time * 9) * 0.15 : 0.15 + night * 0.2;
    windowOn(ctx, [rel(W / 2, -0.28, 8), rel(W / 2, 0.12, 8), rel(W / 2, 0.12, 14), rel(W / 2, -0.28, 14)], Math.max(night, glow));
    gableRoof(ctx, 0, 0, W, D, 27, 48, 0.16, { front: '#6f6a66', back: '#4c4744', gable: '#5a3d2a', snow: '#f7fbff', shingle: 'rgba(30,20,15,0.35)' });
    // Stone chimney.
    prism(ctx, -0.35, -0.25, 0.3, 0.3, 26, 36, { left: '#9aa4b1', right: '#6b7584', top: '#2a2a30' });
    // Rising smoke: thicker while fish are on the racks.
    const top = rel(-0.35, -0.25, 64);
    const puffs = busy ? 6 : 2;
    for (let i = 0; i < puffs; i++) {
      const k = ((time * 0.35 + i / puffs) % 1);
      ctx.globalAlpha = (1 - k) * (busy ? 0.75 : 0.35);
      ball(ctx, top.x + Math.sin(time + i) * 3 + k * 10, top.y - k * 40, 4 + k * 8, 3.4 + k * 7, '#f4f1ec', '#d6d0c8', '#aaa29a');
    }
    ctx.globalAlpha = 1;
    // Drying rack with salmon on the side; filled racks glow amber as they smoke.
    const r0 = rel(-W / 2 - 0.3, 0.1);
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(r0.x - 12, r0.y + 4);
    ctx.lineTo(r0.x - 12, r0.y - 24);
    ctx.lineTo(r0.x + 10, r0.y - 30);
    ctx.lineTo(r0.x + 10, r0.y - 2);
    ctx.stroke();
    s.slots.forEach((v, i) => {
      if (v < 0) return;
      ctx.save();
      ctx.translate(r0.x - 6 + i * 11, r0.y - 22 - i * 3);
      ctx.rotate(Math.PI / 2 + Math.sin(time * 2 + i) * 0.06);
      drawItem(ctx, v > 0.5 ? 'smoked' : 'salmon', 6, 0, 0.7);
      ctx.restore();
    });
    // Ready crates stacked by the drop spot.
    const cp = rel(W / 2 + 0.1, D / 2 + 0.25);
    const crates = Math.min(8, s.ready);
    for (let i = 0; i < crates; i++) drawItem(ctx, 'smoked', cp.x + (i % 2) * 9 - 4, cp.y - 4 - Math.floor(i / 2) * 6.5, 1);
    if (s.ready > 8) {
      ctx.font = '900 10px system-ui';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,30,45,0.85)';
      ctx.strokeText(`${s.ready}`, cp.x + 1, cp.y - 34);
      ctx.fillStyle = '#ffcf7a';
      ctx.fillText(`${s.ready}`, cp.x + 1, cp.y - 34);
    }
    // Raw salmon waiting.
    const rp = rel(-0.1, D / 2 + 0.35);
    for (let i = 0; i < Math.min(4, s.raw); i++) drawItem(ctx, 'salmon', rp.x - 6 + i * 5, rp.y - 2 - i * 2, 0.8);
  });
}

/* ---------------- Fish market ---------------- */

export function drawMarket(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 48, 0.85, sx, sy, () => {
    softShadow(ctx, 4, 4, 58, 24, 0.3);
    for (const [x, y] of [[-0.75, -0.45], [0.75, -0.45], [-0.75, 0.45], [0.75, 0.45]] as const) {
      prism(ctx, x, y, 0.12, 0.12, 38, 0, { left: C.woodDark, right: '#6e3f22' });
    }
    // Counter with ice and fish on display.
    prism(ctx, 0, 0.3, 1.6, 0.5, 16, 0, { left: vGrad(ctx, -16, 0, '#6aa3c9', '#3f7aa3'), right: '#2c5f84', top: '#e6f4fb' });
    const top = rel(-0.5, 0.3, 16);
    drawItem(ctx, 'smoked', top.x + 4, top.y - 3, 0.9);
    drawItem(ctx, 'salmon', top.x + 22, top.y + 3, 0.85);
    drawItem(ctx, 'smoked', top.x + 36, top.y + 8, 0.9);
    // Teal-and-white awning.
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const x0 = -0.9 + (1.8 / stripes) * i;
      const x1 = x0 + 1.8 / stripes;
      poly(ctx, [rel(x0, -0.6, 44), rel(x1, -0.6, 44), rel(x1, 0.7, 35), rel(x0, 0.7, 35)], i % 2 ? '#f4f1ea' : '#2f9ea0');
    }
    for (let i = 0; i < 6; i++) {
      const p = rel(-0.9 + (1.8 / 6) * (i + 0.5), 0.7, 33);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.2, 0, Math.PI);
      ctx.fillStyle = i % 2 ? '#f4f1ea' : '#1f7476';
      ctx.fill();
    }
    poly(ctx, [rel(-0.85, -0.55, 45), rel(0.9, -0.55, 45), rel(0.9, -0.2, 43), rel(-0.85, -0.2, 43)], '#ffffff');
    // Hanging fish sign.
    const sgn = rel(0.9, 0.7, 30);
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sgn.x, sgn.y);
    ctx.lineTo(sgn.x, sgn.y + 4);
    ctx.stroke();
    fillRR(ctx, sgn.x - 9, sgn.y + 4, 18, 9, 2, '#f6e7c4', '#8d5330', 0.8);
    drawItem(ctx, 'salmon', sgn.x + 1, sgn.y + 8.5, 0.55);
    // Lantern.
    const l = rel(-0.75, 0.45, 34);
    ball(ctx, l.x - 3, l.y + 5, 3.2, 3.8, '#fff3c4', night > 0.2 ? '#ffd77a' : '#e8b83a', '#a87a14');
  });
}

/* ---------------- Ice fishers' hut ---------------- */

export function drawLakeCamp(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 52, 0.8, sx, sy, () => {
    softShadow(ctx, 4, 5, 54, 22, 0.3);
    const W = 1.3;
    const D = 1.0;
    prism(ctx, 0, 0, W, D, 22, 0, { left: vGrad(ctx, -22, 0, '#5cc4c4', '#2f9ea0'), right: vGrad(ctx, -22, 0, '#3aa8a8', '#1f7476') });
    poly(ctx, [rel(-0.2, D / 2, 0), rel(0.2, D / 2, 0), rel(0.2, D / 2, 16), rel(-0.2, D / 2, 16)], '#1d3a44');
    windowOn(ctx, [rel(W / 2, -0.28, 9), rel(W / 2, 0.1, 9), rel(W / 2, 0.1, 16), rel(W / 2, -0.28, 16)], night);
    gableRoof(ctx, 0, 0, W, D, 21, 42, 0.14, { front: '#e9e2d6', back: '#b8ad9c', gable: '#2f9ea0', snow: '#f7fbff' });
    // Rods leaning on the wall and an ice auger.
    const r = rel(-W / 2 - 0.05, D / 2 - 0.1);
    ctx.strokeStyle = '#7a4b2a';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(r.x - 4 + i * 5, r.y + 2);
      ctx.lineTo(r.x + 4 + i * 5, r.y - 34);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(40,40,40,0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(r.x + 4, r.y - 34);
    ctx.lineTo(r.x + 8 + Math.sin(time * 2) * 1.5, r.y - 14);
    ctx.stroke();
    const a = rel(W / 2 + 0.25, D / 2 + 0.2);
    ctx.fillStyle = '#9aa4b1';
    ctx.fillRect(a.x - 1, a.y - 22, 2, 20);
    ctx.fillStyle = '#c7372f';
    ctx.fillRect(a.x - 6, a.y - 24, 12, 3);
    ellipse(ctx, a.x, a.y, 4, 1.8, 'rgba(40,60,80,0.25)');
  });
}
