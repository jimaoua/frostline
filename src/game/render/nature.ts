import { easeOutBack } from '../core/math';
import type { ResourceNode } from '../core/types';
import { C } from './palette';
import { ball, ellipse, poly, softShadow } from './shapes';
import { drawSprite, type SpriteCache } from './sprites';

type Ctx = CanvasRenderingContext2D;

interface TreeLook {
  scale: number;
  tiers: number;
  width: number;
  light: string;
  mid: string;
  dark: string;
  snow: number; // 0..1 how heavy the snow load is
  slim: number;
}

const TREES: TreeLook[] = [
  { scale: 0.92, tiers: 4, width: 36, light: '#4a9a92', mid: '#2e6f73', dark: '#1d4c50', snow: 0.45, slim: 1 },
  { scale: 1.0, tiers: 4, width: 38, light: '#4f9e8a', mid: '#2f7468', dark: '#1d4d45', snow: 0.55, slim: 1 },
  { scale: 1.1, tiers: 5, width: 40, light: '#4a9a92', mid: '#2e6f73', dark: '#1d4c50', snow: 0.35, slim: 1 },
  { scale: 0.95, tiers: 4, width: 42, light: '#5aa59a', mid: '#367e78', dark: '#225a56', snow: 0.8, slim: 1.1 },
  { scale: 1.15, tiers: 5, width: 30, light: '#4a9086', mid: '#2b6762', dark: '#1a4642', snow: 0.4, slim: 0.8 },
  // Elder pine: huge, old, deep green.
  { scale: 1.45, tiers: 6, width: 44, light: '#5aa070', mid: '#2f6d48', dark: '#1a4630', snow: 0.6, slim: 1 },
];

function paintTree(g: Ctx, v: number): void {
  const L = TREES[v];
  const sc = L.scale;
  softShadow(g, 6 * sc, 0, 24 * sc, 9 * sc, 0.3);
  const tg = g.createLinearGradient(-4 * sc, 0, 4 * sc, 0);
  tg.addColorStop(0, '#9a6a44');
  tg.addColorStop(0.5, C.trunk);
  tg.addColorStop(1, '#3f2412');
  g.fillStyle = tg;
  g.fillRect(-4 * sc, -16 * sc, 8 * sc, 16 * sc);
  ellipse(g, 0, 0, 4 * sc, 1.8 * sc, '#3f2412');
  // Snow mound at the base.
  ellipse(g, -2 * sc, 1 * sc, 9 * sc, 3 * sc, '#ffffff');

  for (let i = 0; i < L.tiers; i++) {
    const k = i / L.tiers;
    const tw = (L.width - k * L.width * 0.7) * sc * L.slim;
    const th = 27 * sc;
    const by = (-11 - i * (L.tiers > 4 ? 15 : 17)) * sc;
    const apex = { x: 0, y: by - th };
    const droop = 4 * sc;
    // Body: lit left half, shaded right half, drooping bough tips.
    const grad = g.createLinearGradient(-tw / 2, by - th, tw / 2, by);
    grad.addColorStop(0, L.light);
    grad.addColorStop(0.5, L.mid);
    grad.addColorStop(1, L.dark);
    g.beginPath();
    g.moveTo(apex.x, apex.y);
    g.lineTo(-tw / 2, by);
    g.quadraticCurveTo(-tw / 4, by + droop, 0, by + droop * 0.6);
    g.quadraticCurveTo(tw / 4, by + droop, tw / 2, by);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    poly(g, [apex, { x: 0, y: by + droop * 0.6 }, { x: tw / 2, y: by }], 'rgba(10,30,40,0.22)');
    // Snow load: a wavy cap on each tier, thicker on the lit side.
    const sn = 0.3 + L.snow * 0.3;
    g.beginPath();
    g.moveTo(apex.x, apex.y - 1);
    g.lineTo(-tw * 0.36 * (0.7 + L.snow * 0.4), by - th * (1 - sn - 0.25));
    g.quadraticCurveTo(-tw * 0.22, by - th * (0.62 - sn * 0.3), -tw * 0.08, by - th * (0.72 - sn * 0.4));
    g.quadraticCurveTo(tw * 0.06, by - th * (0.6 - sn * 0.3), tw * 0.18, by - th * (0.7 - sn * 0.35));
    g.quadraticCurveTo(tw * 0.26, by - th * (0.6 - sn * 0.3), tw * 0.3, by - th * (0.68 - sn * 0.3));
    g.closePath();
    const sg = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(1, '#d4e2f0');
    g.fillStyle = sg;
    g.fill();
    // Snow lip along the bough edge.
    g.beginPath();
    g.moveTo(-tw / 2, by);
    g.quadraticCurveTo(-tw / 4, by + droop + 1, 0, by + droop * 0.6);
    g.lineTo(0, by + droop * 0.6 - 2.2 * sc);
    g.quadraticCurveTo(-tw / 4, by + droop - 1.8 * sc, -tw / 2 + 2 * sc, by - 2 * sc);
    g.closePath();
    g.fillStyle = '#f4f9ff';
    g.fill();
  }
  ball(g, 0, -(11 + L.tiers * (L.tiers > 4 ? 15 : 17) + 14) * sc, 3 * sc, 2.6 * sc, '#ffffff', '#f4f9ff', '#c6d5e6');
}

function paintStump(g: Ctx, elder: boolean): void {
  const s = elder ? 1.5 : 1;
  softShadow(g, 2, 0, 12 * s, 5 * s);
  g.fillStyle = g.createLinearGradient(-5 * s, 0, 5 * s, 0);
  (g.fillStyle as CanvasGradient).addColorStop(0, '#9a6a44');
  (g.fillStyle as CanvasGradient).addColorStop(1, '#4a2a14');
  g.fillRect(-5 * s, -7 * s, 10 * s, 7 * s);
  ellipse(g, 0, 0, 5 * s, 2.2 * s, '#4a2a14');
  ellipse(g, 0, -7 * s, 5 * s, 2.2 * s, C.logEnd);
  ellipse(g, 0, -7 * s, 3 * s, 1.3 * s, C.logRing);
  ellipse(g, 0, -7 * s, 1 * s, 0.5 * s, C.woodDark);
  ellipse(g, -2 * s, -8 * s, 2.8 * s, 1.2 * s, '#ffffff');
}

const ROCK_SHAPES: [number, number][][] = [
  [[-19, 0], [-16, -14], [-4, -24], [10, -20], [19, -6], [14, 3], [-8, 4]],
  [[-16, 2], [-18, -9], [-8, -18], [6, -21], [16, -12], [18, 0], [4, 5]],
  [[-21, 1], [-14, -11], [-2, -15], [12, -14], [21, -3], [12, 4], [-10, 5]],
  [[-12, 2], [-14, -16], [-4, -28], [8, -26], [14, -10], [10, 4]],
  [[-20, 2], [-17, -8], [-10, -13], [0, -11], [9, -17], [19, -7], [16, 4], [-4, 6]],
];

function paintRock(g: Ctx, v: number, ore: boolean): void {
  const sc = ore ? 1.15 : [0.9, 1.05, 1.15, 1.0, 1.1][v];
  softShadow(g, 4, 1, 25 * sc, 9 * sc, 0.32);
  const pts = ROCK_SHAPES[v % ROCK_SHAPES.length].map(([x, y]) => ({ x: x * sc, y: y * sc }));
  const base = ore ? ['#7a8696', '#556072', '#323a48'] : ['#c3ccd6', C.rock, '#5f6b7b'];
  const grad = g.createLinearGradient(-20 * sc, -24 * sc, 18 * sc, 4 * sc);
  grad.addColorStop(0, base[0]);
  grad.addColorStop(0.5, base[1]);
  grad.addColorStop(1, base[2]);
  poly(g, pts, grad, ore ? '#262c36' : '#4f5a68', 1);
  // Facets.
  const top = pts.reduce((a, b) => (b.y < a.y ? b : a));
  poly(g, [pts[0], pts[1], top, { x: top.x - 2 * sc, y: top.y + 12 * sc }], 'rgba(255,255,255,0.18)');
  poly(g, [top, pts[pts.length - 3], pts[pts.length - 2], { x: top.x + 3 * sc, y: top.y + 14 * sc }], 'rgba(0,0,20,0.18)');
  // Cracks.
  g.strokeStyle = 'rgba(40,48,60,0.4)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(top.x - 2 * sc, top.y + 6 * sc);
  g.lineTo(top.x + 1 * sc, top.y + 13 * sc);
  g.lineTo(top.x - 3 * sc, top.y + 18 * sc);
  g.stroke();
  if (ore) {
    // Glowing amber veins.
    const veins: [number, number, number][] = [[-6, -8, 3], [4, -12, 2.4], [8, -4, 2], [-10, -2, 1.8]];
    for (const [x, y, r] of veins) {
      ellipse(g, x * sc, y * sc, r * 1.9 * sc, r * sc, 'rgba(255,170,60,0.35)');
      ellipse(g, x * sc, y * sc, r * sc, r * 0.6 * sc, '#ffb347');
      ellipse(g, x * sc - 0.4, y * sc - 0.4, r * 0.45 * sc, r * 0.3 * sc, '#fff3c4');
    }
  }
  // Snow cap.
  g.beginPath();
  g.moveTo(pts[1].x, pts[1].y + 2);
  g.quadraticCurveTo(top.x - 6 * sc, top.y - 3 * sc, top.x, top.y - 1);
  g.quadraticCurveTo(top.x + 8 * sc, top.y - 1, pts[pts.length - 3].x - 2 * sc, pts[pts.length - 3].y + 2);
  g.quadraticCurveTo(top.x + 4 * sc, top.y + 6 * sc, top.x - 2 * sc, top.y + 5 * sc);
  g.quadraticCurveTo(top.x - 8 * sc, top.y + 7 * sc, pts[1].x, pts[1].y + 2);
  g.fillStyle = '#f7fbff';
  g.fill();
}

function paintRubble(g: Ctx): void {
  softShadow(g, 0, 0, 16, 6);
  for (const [x, y, r] of [[-7, -2, 4], [3, -1, 5], [8, -4, 3], [-2, -5, 3]] as const) {
    ball(g, x, y, r, r * 0.75, C.rockLight, C.rock, C.rockDark);
  }
}

export function drawNode(ctx: Ctx, cache: SpriteCache, n: ResourceNode, sx: number, sy: number, time: number, windSway: number): void {
  const pop = n.popT > 0 ? Math.max(0.01, easeOutBack(1 - n.popT / 0.5)) : 1;
  const shakeX = n.shake > 0 ? Math.sin(time * 55) * n.shake * 2.4 : 0;
  if (n.kind === 'tree') {
    if (n.amount > 0) {
      const big = n.variant === 5;
      const s = cache.get(`tree${n.variant}`, big ? 130 : 96, big ? 224 : 162, big ? 65 : 48, big ? 210 : 150, (g) => paintTree(g, n.variant));
      // Gentle wind sway: shear the canopy, keep the trunk planted.
      const sway = Math.sin(time * 1.3 + n.pos.x * 0.7 + n.pos.y) * 0.02 * windSway;
      ctx.save();
      ctx.translate(sx + shakeX, sy);
      ctx.transform(1, 0, sway, 1, 0, 0);
      drawSprite(ctx, s, 0, 0, pop);
      ctx.restore();
      if (n.elder && n.interactive) {
        // A faint golden shimmer marks rich old-growth.
        const a = 0.25 + Math.sin(time * 3 + n.id) * 0.15;
        ctx.globalAlpha = a;
        ellipse(ctx, sx, sy - 4, 22, 8, '#ffe58a');
        ctx.globalAlpha = 1;
      }
    } else {
      drawSprite(ctx, cache.get(n.elder ? 'stumpE' : 'stump', 40, 30, 20, 20, (g) => paintStump(g, n.elder)), sx, sy);
    }
  } else if (n.amount > 0) {
    const ore = n.kind === 'ore';
    const s = cache.get(`${n.kind}${n.variant}`, 64, 48, 32, 38, (g) => paintRock(g, n.variant, ore));
    drawSprite(ctx, s, sx + shakeX, sy, pop);
    if (ore) {
      const tw = Math.max(0, Math.sin(time * 2.4 + n.id));
      ctx.globalCompositeOperation = 'lighter';
      ellipse(ctx, sx - 5, sy - 12, 2.5 + tw * 2, 2.5 + tw * 2, `rgba(255,190,90,${0.3 + tw * 0.4})`);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    drawSprite(ctx, cache.get('rubble', 36, 20, 18, 13, paintRubble), sx, sy);
  }
}
