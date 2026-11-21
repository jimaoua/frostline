import { screenDirToWorldDir } from '../core/iso';
import { BUILD_TIME } from '../core/constants';
import { clamp } from '../core/math';
import type { Caravan, GateDoor, ItemKind, Kitchen, Pad, Trap, Tower, Vec, World } from '../core/types';
import type { GateDef } from '../world/layout';
import { padShownRatio } from '../systems/feel';
import { drawItem } from './items';
import { counterTier, grillBack, grillFront, lumberTier, pondTier, stashBack } from './tiers';
import { C } from './palette';
import {
  ball,
  cylGrad,
  ellipse,
  fillRR,
  gableRoof,
  logWalls,
  onGround,
  poly,
  prism,
  pyramidRoof,
  rel,
  roundRectPath,
  softShadow,
  vGrad,
  windowOn,
} from './shapes';

type Ctx = CanvasRenderingContext2D;


/** Squash factor when something receives an item. */
export function bumpScale(bumpAt: number, time: number): number {
  const t = (time - bumpAt) / 0.25;
  return t >= 1 || t < 0 ? 1 : 1 - Math.sin(t * Math.PI) * 0.1;
}

/** A building being paid for on its pad: progress 0..1 and its last beats. */
export interface SiteState {
  q: number;
  stageAt: number;
  bumpAt: number;
}

let SITE: SiteState | null = null;

/**
 * Draw a structure as a construction site instead of a finished building.
 * Every building's own draw function goes through `withBuild`, which checks
 * this, so one site renderer serves all of them.
 */
export function withSite(site: SiteState, draw: () => void): void {
  SITE = site;
  try {
    draw();
  } finally {
    SITE = null;
  }
}

const SCAFFOLD = '#a8693c';

/** Scaffold posts on the three visible corners, with cross beams below `postH`. */
function scaffold(ctx: Ctx, foot: number, postH: number, alpha = 1): void {
  if (postH <= 0) return;
  ctx.globalAlpha = alpha;
  const corners = [rel(-foot, foot), rel(foot, foot), rel(foot, -foot)];
  ctx.strokeStyle = '#6e4224';
  ctx.lineWidth = 4;
  for (const c of corners) {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x, c.y - postH);
    ctx.stroke();
  }
  ctx.strokeStyle = SCAFFOLD;
  ctx.lineWidth = 2.5;
  for (const c of corners) {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x, c.y - postH);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let z = 14; z < postH - 2; z += 16) {
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y - z);
    ctx.lineTo(corners[1].x, corners[1].y - z);
    ctx.lineTo(corners[2].x, corners[2].y - z);
    ctx.stroke();
  }
  // Diagonal brace on the front face once the frame is tall enough.
  if (postH > 24) {
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y - 2);
    ctx.lineTo(corners[1].x, corners[1].y - Math.min(postH - 4, 40));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * The site in four stages, growing smoothly with what has landed on the pad:
 *  1. Foundations (0–25 %): a dirt patch, then a stone plinth spreading out.
 *  2. Frame (25–60 %): scaffold posts climb and beams appear between them.
 *  3. Walls (60–90 %): the real building rises inside the scaffold.
 *  4. Finishing (90–100 %): walls reach the eaves; the roof goes on when the
 *     last item lands (the finished building then takes over).
 * Each stage change pops the whole site; every landing gives it a nudge.
 */
function drawSite(ctx: Ctx, site: SiteState, time: number, height: number, foot: number, draw: () => void): void {
  const q = site.q;
  const ps = (time - site.stageAt) / 0.32;
  const pop = ps >= 0 && ps < 1 ? Math.sin(ps * Math.PI) * 0.1 * (1 - ps) : 0;
  const bs = (time - site.bumpAt) / 0.14;
  const nudge = bs >= 0 && bs < 1 ? Math.sin(bs * Math.PI) * 0.025 : 0;
  const sq = 1 + pop + nudge;
  ctx.scale(1 / sq, sq);

  // 1. Foundations.
  const k1 = clamp(q / 0.25, 0, 1);
  const pad = foot * 2 + 0.2;
  ctx.fillStyle = 'rgba(120,92,66,0.45)';
  const g = [rel(-pad / 2, -pad / 2), rel(pad / 2, -pad / 2), rel(pad / 2, pad / 2), rel(-pad / 2, pad / 2)];
  ctx.beginPath();
  ctx.moveTo(g[0].x, g[0].y);
  for (const pt of g.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.fill();
  const plinth = foot * 2 * (0.35 + 0.65 * k1);
  prism(ctx, 0, 0, plinth, plinth, 3 + 4 * k1, 0, {
    left: '#8d97a3',
    right: '#6d7783',
    top: '#b9c2cc',
    stroke: 'rgba(40,48,60,0.5)',
  });
  // Corner stakes go in as the foundation spreads.
  ctx.fillStyle = '#7a4a28';
  for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const) {
    const c = rel((x * plinth) / 2, (y * plinth) / 2, 7 * k1);
    ctx.fillRect(c.x - 1.5, c.y - 6 * k1, 3, 6 * k1);
  }

  // 2. Frame rises (back of the scaffold first, so walls sit inside it).
  const k2 = clamp((q - 0.25) / 0.35, 0, 1);
  const postH = (height + 10) * (1 - (1 - k2) * (1 - k2));
  if (postH > 0) {
    const back = rel(-foot, -foot);
    ctx.strokeStyle = SCAFFOLD;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(back.x, back.y);
    ctx.lineTo(back.x, back.y - postH);
    ctx.stroke();
  }

  // 3–4. Walls: the real building, revealed from the ground up.
  const k3 = clamp((q - 0.6) / 0.3, 0, 1);
  const k4 = clamp((q - 0.9) / 0.1, 0, 1);
  const wallH = k3 > 0 ? 6 + height * (0.72 * k3 + 0.1 * k4) : 0;
  if (wallH > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-220, -wallH + 6, 440, wallH + 120);
    ctx.clip();
    draw();
    ctx.restore();
    // Fresh top edge of the wall catches the light.
    ctx.fillStyle = 'rgba(255,240,200,0.35)';
    ctx.fillRect(-60, -wallH + 5, 120, 2);
  }
  scaffold(ctx, foot, postH);
}

/**
 * Construction: scaffolding rises and the building is revealed from the
 * ground up, then lands with a squashy bounce. While a site is set, the
 * structure is drawn as that construction site instead.
 */
export function withBuild(ctx: Ctx, builtAt: number, time: number, height: number, foot: number, sx: number, sy: number, draw: () => void): void {
  ctx.save();
  ctx.translate(sx, sy);
  if (SITE) {
    drawSite(ctx, SITE, time, height, foot, draw);
    ctx.restore();
    return;
  }
  const t = (time - builtAt) / BUILD_TIME;
  if (t < 1) {
    const reveal = clamp(t * 1.15, 0, 1);
    const h = reveal * (height + 30);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-220, -h + 6, 440, h + 120);
    ctx.clip();
    draw();
    ctx.restore();
    scaffold(ctx, foot, height + 10, 1 - clamp((t - 0.6) / 0.4, 0, 1));
  } else {
    const k = (time - builtAt - BUILD_TIME) / 0.4;
    if (k < 1) {
      // Lands with a bounce: squash, overshoot, settle.
      const sq = 1 + Math.sin(k * Math.PI * 1.5) * 0.12 * (1 - k);
      ctx.scale(1 / sq, sq);
    }
    draw();
  }
  ctx.restore();
}

/* ---------------- Campfire ---------------- */

function flame(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 1.05, y - h * 0.55, x, y - h);
  ctx.quadraticCurveTo(x + w * 1.05, y - h * 0.55, x + w, y);
  ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawCampfire(ctx: Ctx, w: World, sx: number, sy: number, time: number): void {
  const bump = bumpScale(w.structures.campfire.bumpAt, time);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, bump);
  softShadow(ctx, 0, 2, 34, 15, 0.3);
  const stones = Array.from({ length: 11 }, (_, i) => (i / 11) * Math.PI * 2);
  const ring = (front: boolean) => {
    for (const a of stones) {
      if (Math.sin(a) + Math.cos(a) > 0 !== front) continue;
      const p = rel(Math.cos(a) * 0.52, Math.sin(a) * 0.52);
      ball(ctx, p.x, p.y - 3, 6, 4.6, '#c6ced8', '#8b97a6', '#4f5a68');
      ellipse(ctx, p.x - 1, p.y - 6.4, 3, 1.3, '#f6f9fc');
    }
  };
  ring(false);
  const bed = ctx.createRadialGradient(0, -1, 0, 0, -1, 20);
  bed.addColorStop(0, w.fire.lit ? '#ff9a3c' : '#6b5a4c');
  bed.addColorStop(0.5, w.fire.lit ? '#7a2a10' : '#5d4a3c');
  bed.addColorStop(1, '#3a2a22');
  ellipse(ctx, 0, -1, 19, 8.5, bed);

  for (const ang of [-0.45, 0.45, 0]) {
    ctx.save();
    ctx.translate(0, -5);
    ctx.rotate(ang);
    fillRR(ctx, -15, -3, 30, 6, 3, w.fire.lit ? vGrad(ctx, -3, 3, '#7a4224', '#2a140a') : vGrad(ctx, -3, 3, '#d99a5f', '#7a4a28'));
    ellipse(ctx, 15, 0, 2.4, 3, w.fire.lit ? '#ff9a3c' : C.logEnd);
    if (!w.fire.lit) fillRR(ctx, -12, -4.4, 22, 2.6, 1.3, '#ffffff');
    ctx.restore();
  }

  if (w.fire.lit) {
    const grow = Math.min(1, (time - w.fire.litAt) / 0.8);
    const blizz = 1 - w.weather.intensity * 0.3;
    const f = (k: number) => Math.sin(time * k) * 0.5 + Math.sin(time * k * 1.7 + 1) * 0.5;
    const g = grow * blizz * (w.upgrades.bonfire ? 1.35 : 1);
    const lean = (w.weather.windStrength + w.weather.gust) * 3;
    ctx.save();
    ctx.transform(1, 0, -lean * 0.05, 1, 0, 0);
    flame(ctx, -7, -6, 7 * g, (26 + f(9) * 4) * g, '#ff6a1a');
    flame(ctx, 7, -6, 7 * g, (24 + f(11) * 4) * g, '#ff6a1a');
    flame(ctx, 0, -5, 11 * g, (40 + f(8) * 5) * g, '#ff8f2a');
    flame(ctx, 0, -5, 7.5 * g, (29 + f(13) * 4) * g, '#ffc23d');
    flame(ctx, 0, -5, 4 * g, (16 + f(17) * 3) * g, '#fff6c4');
    ctx.restore();
  }
  ring(true);
  ctx.restore();
}

/* ---------------- Kitchen ---------------- */

export function drawFishPond(ctx: Ctx, sx: number, sy: number, time: number, lv = 1, lvAt = -10): void {
  onGround(ctx, sx, sy, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.08, 0.92, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const g = ctx.createRadialGradient(-0.3, -0.3, 0.05, 0, 0, 1);
    g.addColorStop(0, '#e6f6ff');
    g.addColorStop(0.6, '#a9d6f2');
    g.addColorStop(1, '#7bb4dc');
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.98, 0.82, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    // Cracks and sheen.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.2);
    ctx.lineTo(-0.2, 0.05);
    ctx.lineTo(0.1, -0.35);
    ctx.moveTo(0.3, 0.4);
    ctx.lineTo(0.6, 0.2);
    ctx.stroke();
    ctx.globalAlpha = 0.5 + Math.sin(time * 1.5) * 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-0.45, -0.4, 0.28, 0.06, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // The fishing hole.
    ctx.beginPath();
    ctx.ellipse(0.25, 0.1, 0.24, 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const hole = ctx.createRadialGradient(0.25, 0.1, 0, 0.25, 0.1, 0.2);
    hole.addColorStop(0, '#0e3a5c');
    hole.addColorStop(1, '#2a6f9e');
    ctx.beginPath();
    ctx.ellipse(0.25, 0.1, 0.18, 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = hole;
    ctx.fill();
    const rip = (time * 0.6) % 1;
    ctx.strokeStyle = `rgba(200,235,255,${0.6 * (1 - rip)})`;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.ellipse(0.25, 0.1, 0.05 + rip * 0.12, 0.04 + rip * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  // A bucket and ice chunks on the rim.
  const b = rel(-0.7, 0.75);
  ball(ctx, sx + b.x + 10, sy + b.y - 6, 4, 3.5, '#ffffff', '#cfe6f6', '#8fb8d6');
  ball(ctx, sx + b.x - 4, sy + b.y - 3, 3, 2.6, '#ffffff', '#cfe6f6', '#8fb8d6');
  pondTier(ctx, sx, sy, lv, time, lvAt);
}

export function drawGrill(ctx: Ctx, k: Kitchen, bumpAt: number, sx: number, sy: number, time: number, builtAt: number, lv = 1, lvAt = -10): void {
  withBuild(ctx, builtAt, time, 26, 0.6, sx, sy, () => {
    ctx.scale(1, bumpScale(bumpAt, time));
    softShadow(ctx, 2, 2, 34, 13, 0.3);
    grillBack(ctx, lv, time, lvAt);
    prism(ctx, 0, 0, 1.25, 0.75, 16, 0, { left: vGrad(ctx, -20, 0, '#9aa6b4', '#5f6b7b'), right: vGrad(ctx, -20, 0, '#7a8696', '#465060'), top: '#3a2a22' });
    // Stone texture.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (const [x, y] of [[-18, -6], [-6, -10], [8, -4], [20, -9]] as const) ctx.fillRect(x, y, 6, 3);
    // Glowing coals.
    for (let i = 0; i < 7; i++) {
      const p = rel(-0.5 + i * 0.16, (i % 2) * 0.15 - 0.05, 16);
      const glow = 0.6 + Math.sin(time * 4 + i) * 0.3;
      ellipse(ctx, p.x, p.y, 3.2, 1.6, `rgba(255,${100 + glow * 80},40,${glow})`);
    }
    // Iron grate.
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const a = rel(-0.6 + i * 0.2, -0.36, 18);
      const b = rel(-0.6 + i * 0.2, 0.36, 18);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    grillFront(ctx, lv, time, lvAt);
    // Fish cooking on the grate: raw blue → golden.
    k.slots.forEach((p, i) => {
      if (p < 0) return;
      const pos = rel(-0.38 + i * 0.38, 0, 21);
      drawItem(ctx, p > 0.55 ? 'meal' : 'fish', pos.x, pos.y, 0.9);
    });
    // Raw fish waiting in a crate on the left.
    const crate = rel(-0.95, 0.15);
    prism(ctx, -0.95, 0.15, 0.35, 0.35, 9, 0, { left: C.wood, right: C.woodDark, top: '#5a3420' });
    for (let i = 0; i < Math.min(4, k.raw); i++) drawItem(ctx, 'fish', crate.x + (i % 2) * 3 - 1, crate.y - 11 - i * 2.6, 0.7);
    // Cooked meals on the tray to the right.
    const tray = rel(0.55, 0.35);
    poly(ctx, [rel(0.3, 0.2, 2), rel(0.8, 0.2, 2), rel(0.8, 0.55, 2), rel(0.3, 0.55, 2)], '#c9b48d', '#8a6a40', 1);
    for (let i = 0; i < Math.min(12, k.tray); i++) drawItem(ctx, 'meal', tray.x + (i % 2 ? 4 : -3), tray.y - 4 - Math.floor(i / 2) * 3.6, 0.8);
  });
}

export function drawCounter(ctx: Ctx, meals: number, bumpAt: number, sx: number, sy: number, time: number, builtAt: number, night: number, lv = 1, lvAt = -10): void {
  withBuild(ctx, builtAt, time, 50, 0.6, sx, sy, () => {
    ctx.scale(1, bumpScale(bumpAt, time));
    softShadow(ctx, 0, 2, 30, 12);
    // Posts and a little shingled awning over the hatch.
    for (const [x, y] of [[-0.48, -0.32], [0.48, -0.32]] as const) prism(ctx, x, y, 0.09, 0.09, 46, 0, { left: C.wood, right: C.woodDark });
    prism(ctx, 0, 0, 1.0, 0.55, 18, 0, { left: vGrad(ctx, -18, 0, '#d99a5f', '#9a5f34'), right: vGrad(ctx, -18, 0, '#a8693c', '#6e3d1e'), top: '#e8c08a' });
    // Plank lines.
    ctx.strokeStyle = 'rgba(80,40,15,0.4)';
    for (let z = 5; z < 18; z += 5) {
      const a = rel(-0.5, 0.275, z);
      const b = rel(0.5, 0.275, z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const [x, y] of [[-0.48, 0.32], [0.48, 0.32]] as const) prism(ctx, x, y, 0.09, 0.09, 42, 0, { left: C.wood, right: C.woodDark });
    // Meals stacked on the counter top.
    const top = rel(0, 0, 18);
    for (let i = 0; i < Math.min(14, meals); i++) {
      const col = i % 3;
      drawItem(ctx, 'meal', top.x - 9 + col * 9, top.y - 1 - Math.floor(i / 3) * 3.6, 0.85);
    }
    pyramidRoof(ctx, 0, 0, 1.25, 0.85, 42, 56, { left: C.roofLight, right: C.roof, back: C.roofDark, snow: '#f7fbff' });
    // Lantern.
    const l = rel(0.5, 0.32, 38);
    ball(ctx, l.x + 3, l.y + 4, 3.4, 4, '#fff3c4', night > 0.2 ? '#ffd77a' : '#e8b83a', '#a87a14');
    // Sign: fish.
    const s = rel(-0.15, 0.32, 40);
    fillRR(ctx, s.x - 9, s.y - 6, 18, 10, 2, '#5a3420');
    drawItem(ctx, 'meal', s.x, s.y - 1, 0.75);
    counterTier(ctx, lv, time, lvAt, night);
  });
}

export function drawCashPad(ctx: Ctx, cash: number, bumpAt: number, sx: number, sy: number, time: number): void {
  onGround(ctx, sx, sy, () => {
    roundRectPath(ctx, -0.5, -0.5, 1, 1, 0.12);
    ctx.fillStyle = 'rgba(34,96,52,0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.14, 0.09]);
    ctx.lineDashOffset = -time * 0.4;
    ctx.stroke();
    ctx.setLineDash([]);
    if (cash <= 0) {
      ctx.scale(1 / 32, 1 / 32);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0.02);
    }
  });
  const bundles = Math.min(32, Math.ceil(cash / 10));
  const sq = bumpScale(bumpAt, time);
  const cols: [number, number][] = [[-0.2, -0.15], [0.15, -0.2], [-0.15, 0.18], [0.2, 0.15]];
  for (let i = 0; i < bundles; i++) {
    const [cx, cy] = cols[i % cols.length];
    const p = rel(cx, cy);
    drawItem(ctx, 'coin', sx + p.x, sy + p.y - 3 - Math.floor(i / cols.length) * 3.4 * sq, 1);
  }
}

/* ---------------- Buildings ---------------- */

export function drawLumberHut(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number, lv = 1, lvAt = -10): void {
  withBuild(ctx, builtAt, time, 56, 0.9, sx, sy, () => {
    softShadow(ctx, 6, 6, 62, 26, 0.32);
    const W = 1.7;
    const D = 1.4;
    logWalls(ctx, W, D, 30, '#e8b07a', '#b8743f', '#8a5230');
    poly(ctx, [rel(-0.25, D / 2, 0), rel(0.25, D / 2, 0), rel(0.25, D / 2, 21), rel(-0.25, D / 2, 21)], vGrad(ctx, -21, 0, '#6b3f22', '#3f2412'), '#2a160a', 1);
    ellipse(ctx, rel(0.15, D / 2, 10).x, rel(0.15, D / 2, 10).y, 1.2, 1.2, '#e8c24a');
    windowOn(ctx, [rel(W / 2, -0.35, 12), rel(W / 2, 0.15, 12), rel(W / 2, 0.15, 22), rel(W / 2, -0.35, 22)], night);
    gableRoof(ctx, 0, 0, W, D, 29, 54, 0.18, { front: C.roofLight, back: C.roofDark, gable: '#a8683a', snow: '#f7fbff', shingle: 'rgba(90,30,20,0.35)' });
    prism(ctx, 0.45, -0.3, 0.22, 0.22, 16, 46, { left: '#8b97a6', right: '#5f6b7b', top: '#3a3a40' });
    // Chopping block and stacked logs.
    const b = rel(W / 2 + 0.35, D / 2 + 0.25);
    ellipse(ctx, b.x, b.y, 8, 3.5, '#4a2a14');
    ctx.fillStyle = cylGrad(ctx, b.x - 8, b.x + 8, '#b07848', '#7a4b2a', '#4a2a14');
    ctx.fillRect(b.x - 8, b.y - 8, 16, 8);
    ellipse(ctx, b.x, b.y - 8, 8, 3.5, C.logEnd);
    ellipse(ctx, b.x, b.y - 8, 4, 1.8, C.logRing);
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(b.x + 1, b.y - 22, 2, 15);
    poly(ctx, [{ x: b.x - 1, y: b.y - 11 }, { x: b.x + 6, y: b.y - 13 }, { x: b.x + 6, y: b.y - 7 }, { x: b.x - 1, y: b.y - 7 }], '#b8c4d0');
    const lp = rel(-W / 2 - 0.1, D / 2 + 0.1);
    for (let i = 0; i < 5; i++) drawItem(ctx, 'wood', lp.x + (i % 3) * 4 - 4, lp.y - 3 - Math.floor(i / 3) * 4.6, 1);
    lumberTier(ctx, lv, time, lvAt);
  });
}

export function drawFishShack(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number, valley = false): void {
  withBuild(ctx, builtAt, time, 46, 0.7, sx, sy, () => {
    softShadow(ctx, 4, 4, 46, 20, 0.3);
    const W = 1.2;
    const D = 1.0;
    // Pine Valley: the same hut in dark logs, as the Hunter's Hut.
    prism(ctx, 0, 0, W, D, 26, 0, valley
      ? { left: vGrad(ctx, -26, 0, '#a5714a', '#6e4428'), right: vGrad(ctx, -26, 0, '#8a5a38', '#553320') }
      : { left: vGrad(ctx, -26, 0, '#6aa3c9', '#3f7aa3'), right: vGrad(ctx, -26, 0, '#4f88b0', '#2c5f84') });
    ctx.strokeStyle = valley ? 'rgba(50,25,10,0.4)' : 'rgba(20,50,80,0.35)';
    for (let i = 1; i < 6; i++) {
      const a = rel(-W / 2 + (W / 6) * i, D / 2, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, a.y - 26);
      ctx.stroke();
    }
    poly(ctx, [rel(-0.2, D / 2, 0), rel(0.2, D / 2, 0), rel(0.2, D / 2, 19), rel(-0.2, D / 2, 19)], '#2a3f55');
    windowOn(ctx, [rel(W / 2, -0.3, 11), rel(W / 2, 0.1, 11), rel(W / 2, 0.1, 19), rel(W / 2, -0.3, 19)], night);
    gableRoof(ctx, 0, 0, W, D, 25, 44, 0.14, { front: '#e9e2d6', back: '#b8ad9c', gable: valley ? '#3d6b4a' : '#4f88b0', snow: '#f7fbff' });
    if (valley) {
      // Antlers over the door.
      const a = rel(0, D / 2, 24);
      ctx.strokeStyle = '#efe2c8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const k of [-1, 1]) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + k * 6, a.y - 7);
        ctx.lineTo(a.x + k * 9, a.y - 6);
        ctx.moveTo(a.x + k * 3.5, a.y - 4);
        ctx.lineTo(a.x + k * 3, a.y - 9);
      }
      ctx.stroke();
    }
    // Drying rack (fish, or cuts of meat in Pine Valley).
    const r0 = rel(-W / 2 - 0.25, D / 2 + 0.2);
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(r0.x - 10, r0.y);
    ctx.lineTo(r0.x - 10, r0.y - 22);
    ctx.lineTo(r0.x + 12, r0.y - 22 + 6);
    ctx.lineTo(r0.x + 12, r0.y + 6);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(r0.x - 6 + i * 7, r0.y - 18 + i * 2);
      ctx.rotate(Math.PI / 2 + Math.sin(time * 2 + i) * 0.08);
      drawItem(ctx, 'fish', 6, 0, 0.75);
      ctx.restore();
    }
  });
}

export function drawTradingPost(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 50, 0.9, sx, sy, () => {
    softShadow(ctx, 4, 4, 60, 24, 0.3);
    for (const [x, y] of [[-0.8, -0.6], [0.8, -0.6]] as const) prism(ctx, x, y, 0.14, 0.14, 44, 0, { left: C.woodDark, right: '#6e3f22' });
    prism(ctx, 0, -0.35, 1.7, 0.5, 30, 0, { left: vGrad(ctx, -30, 0, '#c47e45', '#8a5230'), right: '#8a5230', top: C.woodLight });
    prism(ctx, 0, 0.35, 1.8, 0.55, 16, 0, { left: vGrad(ctx, -16, 0, '#d99a5f', '#9a5f34'), right: C.woodDark, top: C.woodLight });
    for (const [x, y] of [[-0.8, 0.6], [0.8, 0.6]] as const) prism(ctx, x, y, 0.14, 0.14, 38, 0, { left: C.woodDark, right: '#6e3f22' });
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const x0 = -0.95 + (1.9 / stripes) * i;
      const x1 = x0 + 1.9 / stripes;
      poly(ctx, [rel(x0, -0.75, 46), rel(x1, -0.75, 46), rel(x1, 0.8, 36), rel(x0, 0.8, 36)], i % 2 ? '#f4f1ea' : '#d64b3c');
    }
    // Scalloped valance.
    for (let i = 0; i < 6; i++) {
      const p = rel(-0.95 + (1.9 / 6) * (i + 0.5), 0.8, 34);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI);
      ctx.fillStyle = i % 2 ? '#f4f1ea' : '#b23a2d';
      ctx.fill();
    }
    poly(ctx, [rel(-0.9, -0.7, 47), rel(0.95, -0.7, 47), rel(0.95, -0.3, 44), rel(-0.9, -0.3, 44)], '#ffffff');
    const c = rel(-0.3, 0.35, 16);
    drawItem(ctx, 'wood', c.x - 6, c.y - 3);
    drawItem(ctx, 'stone', c.x + 12, c.y + 2);
    drawItem(ctx, 'ore', c.x + 2, c.y + 6);
    const s = rel(0.95, 0.8, 30);
    ball(ctx, s.x + 4, s.y + 4, 7, 7, '#ffe58a', '#e8b83a', '#a87a14');
    ctx.fillStyle = '#7a5a10';
    ctx.font = '900 8px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', s.x + 4, s.y + 4.5);
    const l = rel(-0.8, 0.6, 36);
    ball(ctx, l.x - 3, l.y + 5, 3.4, 4, '#fff3c4', night > 0.2 ? '#ffd77a' : '#e8b83a', '#a87a14');
  });
}

export function drawQuarryCamp(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number): void {
  withBuild(ctx, builtAt, time, 38, 0.8, sx, sy, () => {
    softShadow(ctx, 4, 4, 52, 22, 0.3);
    const W = 1.5;
    const D = 1.2;
    poly(ctx, [rel(-W / 2, -D / 2, 0), rel(W / 2, -D / 2, 0), rel(W / 2, 0, 34), rel(-W / 2, 0, 34)], '#c9b48d');
    poly(ctx, [rel(W / 2, -D / 2, 0), rel(W / 2, D / 2, 0), rel(W / 2, 0, 34)], '#a99268');
    poly(ctx, [rel(W / 2, -0.18, 0), rel(W / 2, 0.18, 0), rel(W / 2, 0, 16)], '#4a3a2a');
    const front = [rel(-W / 2, D / 2, 0), rel(W / 2, D / 2, 0), rel(W / 2, 0, 34), rel(-W / 2, 0, 34)];
    const g = ctx.createLinearGradient(front[3].x, front[3].y, front[0].x, front[0].y);
    g.addColorStop(0, '#f0e0bc');
    g.addColorStop(1, '#c9b48d');
    poly(ctx, front, g);
    poly(ctx, [rel(-W / 2, 0.22, 26), rel(W / 2, 0.22, 26), rel(W / 2, 0, 35), rel(-W / 2, 0, 35)], '#f7fbff');
    const cx = -1.05;
    prism(ctx, cx, 0.55, 0.6, 0.45, 12, 3, { left: '#6e7680', right: '#555c66', top: '#3e444c' });
    const top = rel(cx, 0.55, 16);
    drawItem(ctx, 'stone', top.x - 4, top.y);
    drawItem(ctx, 'stone', top.x + 5, top.y - 2);
    const wh = rel(cx, 0.78, 3);
    ball(ctx, wh.x - 7, wh.y, 3.2, 3.2, '#6b5244', '#3b2a22', '#1a120d');
    ball(ctx, wh.x + 7, wh.y - 3, 3.2, 3.2, '#6b5244', '#3b2a22', '#1a120d');
    const p = rel(W / 2 + 0.15, 0.55, 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.35);
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(-1, -22, 2, 22);
    poly(ctx, [{ x: -8, y: -21 }, { x: 0, y: -24 }, { x: 8, y: -21 }, { x: 0, y: -19 }], '#a9b6c4');
    ctx.restore();
  });
}

export function drawWorkshop(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 60, 0.95, sx, sy, () => {
    softShadow(ctx, 6, 6, 66, 28, 0.32);
    const W = 1.8;
    const D = 1.5;
    prism(ctx, 0, 0, W, D, 10, 0, { left: vGrad(ctx, -10, 0, '#a9b3be', '#6f7a88'), right: '#5f6b7b' });
    ctx.save();
    ctx.translate(0, -10);
    logWalls(ctx, W, D, 22, '#d9a26e', '#a8693c', '#7a4524');
    ctx.restore();
    // Big open door with forge glow.
    const glow = 0.6 + Math.sin(time * 6) * 0.15;
    poly(ctx, [rel(-0.4, D / 2, 0), rel(0.3, D / 2, 0), rel(0.3, D / 2, 24), rel(-0.4, D / 2, 24)], `rgba(255,${120 + glow * 60},40,1)`, '#3a2210', 1.4);
    poly(ctx, [rel(-0.3, D / 2, 0), rel(0.2, D / 2, 0), rel(0.2, D / 2, 14), rel(-0.3, D / 2, 14)], '#ffe2a0');
    windowOn(ctx, [rel(W / 2, -0.4, 16), rel(W / 2, 0.1, 16), rel(W / 2, 0.1, 25), rel(W / 2, -0.4, 25)], night);
    gableRoof(ctx, 0, 0, W, D, 31, 58, 0.18, { front: '#6f7a88', back: '#4a5463', gable: '#8a5230', snow: '#f7fbff', shingle: 'rgba(20,30,40,0.35)' });
    prism(ctx, -0.55, -0.35, 0.3, 0.3, 28, 44, { left: '#8b97a6', right: '#5f6b7b', top: '#2a2a30' });
    // Anvil and gear sign.
    const a = rel(W / 2 + 0.35, D / 2 + 0.1);
    prism(ctx, W / 2 + 0.35, D / 2 + 0.1, 0.18, 0.18, 8, 0, { left: C.woodDark, right: '#4a2a14' });
    poly(ctx, [{ x: a.x - 9, y: a.y - 9 }, { x: a.x + 9, y: a.y - 11 }, { x: a.x + 6, y: a.y - 14 }, { x: a.x - 6, y: a.y - 13 }], '#3a3f48');
    const s = rel(0.6, D / 2, 30);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(time * 0.8);
    ctx.fillStyle = '#e8b83a';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-1.5, -8, 3, 3);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a10';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function drawShelter(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 56, 1.0, sx, sy, () => {
    softShadow(ctx, 6, 6, 70, 28, 0.32);
    const W = 1.9;
    const D = 1.5;
    logWalls(ctx, W, D, 30, '#e8b07a', '#b8743f', '#8a5230');
    poly(ctx, [rel(-0.25, D / 2, 0), rel(0.25, D / 2, 0), rel(0.25, D / 2, 22), rel(-0.25, D / 2, 22)], '#4a2a14');
    windowOn(ctx, [rel(-0.75, D / 2, 11), rel(-0.4, D / 2, 11), rel(-0.4, D / 2, 21), rel(-0.75, D / 2, 21)], night);
    windowOn(ctx, [rel(0.45, D / 2, 11), rel(0.8, D / 2, 11), rel(0.8, D / 2, 21), rel(0.45, D / 2, 21)], night);
    windowOn(ctx, [rel(W / 2, -0.3, 11), rel(W / 2, 0.2, 11), rel(W / 2, 0.2, 21), rel(W / 2, -0.3, 21)], night);
    gableRoof(ctx, 0, 0, W, D, 29, 56, 0.2, { front: '#5b8a5a', back: '#3a5f3a', gable: '#a8683a', snow: '#f7fbff', shingle: 'rgba(20,40,20,0.35)' });
    // Wreath over the door.
    const wr = rel(0, D / 2, 26);
    ctx.strokeStyle = '#2e6f4a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(wr.x, wr.y, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ellipse(ctx, wr.x, wr.y + 3.5, 1.4, 1.4, '#e9493a');
  });
}

export function drawTower(ctx: Ctx, t: Tower, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 100, 0.55, sx, sy, () => {
    softShadow(ctx, 4, 4, 34, 14, 0.3);
    const L = 0.36;
    const H = 54;
    for (const [x, y] of [[-L, -L], [L, -L], [-L, L]] as const) prism(ctx, x, y, 0.12, 0.12, H, 0, { left: cylGrad(ctx, -4, 4, '#e2a96f', C.wood, C.woodDark), right: C.woodDark });
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 2;
    const brace = (a: [number, number, number], b: [number, number, number]) => {
      const p = rel(...a);
      const q = rel(...b);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    };
    brace([-L, L, 4], [L, L, H - 6]);
    brace([L, L, 4], [-L, L, H - 6]);
    brace([L, -L, 4], [L, L, H - 6]);
    brace([L, L, 4], [L, -L, H - 6]);
    prism(ctx, L, L, 0.12, 0.12, H, 0, { left: C.wood, right: C.woodDark });
    prism(ctx, 0, 0, 1.05, 1.05, 6, H, { left: C.wood, right: C.woodDark, top: C.woodLight });

    const flip = Math.cos(t.aim) < 0 ? -1 : 1;
    const ar = rel(0, 0, H + 6);
    ctx.save();
    ctx.translate(ar.x, ar.y);
    ctx.scale(flip, 1);
    fillRR(ctx, -5, -14, 10, 14, 4, cylGrad(ctx, -5, 5, '#6fa0e0', '#4a7bc4', '#2d5a99'));
    ball(ctx, 0.5, -18, 5, 5, '#ffe3cc', '#f2c8a0', '#d79b78');
    ctx.beginPath();
    ctx.ellipse(0.5, -19.5, 5.4, 4.6, 0, Math.PI, 0);
    ctx.fillStyle = '#2d5a99';
    ctx.fill();
    ellipse(ctx, 2.6, -18, 0.9, 1.1, '#2a2320');
    ctx.strokeStyle = '#7a4b2a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(6, -9, 7, -1.2, 1.2);
    ctx.stroke();
    ctx.restore();

    for (const [a, b] of [[[-0.52, 0.52], [0.52, 0.52]], [[0.52, 0.52], [0.52, -0.52]]] as const) {
      poly(ctx, [rel(a[0], a[1], H + 6), rel(b[0], b[1], H + 6), rel(b[0], b[1], H + 13), rel(a[0], a[1], H + 13)], 'rgba(140,82,48,0.92)');
    }
    pyramidRoof(ctx, 0, 0, 1.25, 1.25, H + 26, H + 46, { left: C.roofLight, right: C.roof, back: C.roofDark, snow: '#f7fbff' });
    for (const [x, y] of [[-0.48, 0.48], [0.48, 0.48], [0.48, -0.48]] as const) prism(ctx, x, y, 0.07, 0.07, 20, H + 6, { left: C.woodDark, right: '#5a3420' });
    // Torch.
    const tp = rel(0.52, 0.52, H + 16);
    const fl = Math.sin(time * 14) * 1.2;
    flame(ctx, tp.x + 2, tp.y, 2.8, 9 + fl, '#ff8f2a');
    flame(ctx, tp.x + 2, tp.y, 1.6, 6 + fl * 0.6, '#fff3b0');
    if (night > 0.05) ellipse(ctx, tp.x + 2, tp.y - 3, 10, 10, `rgba(255,170,70,${0.2 * night})`);
    const fp = rel(0, 0, H + 46);
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(fp.x - 0.8, fp.y - 12, 1.6, 12);
    poly(ctx, [{ x: fp.x + 0.8, y: fp.y - 12 }, { x: fp.x + 11, y: fp.y - 9 + Math.sin(time * 5) }, { x: fp.x + 0.8, y: fp.y - 6 }], C.band);
  });
}

/* ---------------- Piles and mats ---------------- */

export function drawPile(ctx: Ctx, kind: 'wood' | 'stone', count: number, sx: number, sy: number, bumpAt: number, time: number): void {
  onGround(ctx, sx, sy, () => {
    ctx.fillStyle = 'rgba(110,70,40,0.25)';
    ctx.beginPath();
    ctx.rect(-0.55, -0.45, 1.1, 0.9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.04;
    ctx.setLineDash([0.12, 0.08]);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  const sq = bumpScale(bumpAt, time);
  const n = Math.min(count, 30);
  let placed = 0;
  for (let row = 0; placed < n; row++) {
    const inRow = Math.max(1, 6 - row);
    for (let i = 0; i < inRow && placed < n; i++, placed++) {
      drawItem(ctx, kind, sx + (i - (inRow - 1) / 2) * 11, sy - 2 - row * 4.8 * sq, 1);
    }
  }
  if (count > 30) {
    ctx.font = '900 10px system-ui';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,30,45,0.85)';
    ctx.strokeText(`${count}`, sx, sy - 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${count}`, sx, sy - 40);
  }
}

export function drawTradeMat(ctx: Ctx, coinPile: number, sx: number, sy: number, time: number, bumpAt: number): void {
  onGround(ctx, sx, sy, () => {
    roundRectPath(ctx, -0.6, -0.6, 1.2, 1.2, 0.14);
    ctx.fillStyle = 'rgba(34,96,52,0.45)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.16, 0.1]);
    ctx.lineDashOffset = -time * 0.4;
    ctx.stroke();
    ctx.setLineDash([]);
  });
  const bills = Math.min(32, Math.ceil(coinPile / 4));
  const sq = bumpScale(bumpAt, time);
  const cols: [number, number][] = [[-0.25, -0.15], [0.15, -0.2], [-0.2, 0.2], [0.2, 0.18]];
  for (let i = 0; i < bills; i++) {
    const [cx, cy] = cols[i % cols.length];
    const p = rel(cx, cy);
    drawItem(ctx, 'coin', sx + p.x, sy + p.y - 2 - Math.floor(i / cols.length) * 3.4 * sq, 1);
  }
}

/* ---------------- Defenses ---------------- */

export function drawTrap(ctx: Ctx, t: Trap, sx: number, sy: number, time: number): void {
  const snap = clamp((time - t.snapAt) / 0.15, 0, 1);
  onGround(ctx, sx, sy, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,64,72,0.55)';
    ctx.fill();
    ctx.strokeStyle = '#4a5260';
    ctx.lineWidth = 0.04;
    ctx.stroke();
  });
  const open = t.armed ? 1 : 1 - snap;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(sx, sy - 1);
    ctx.scale(s, 1);
    ctx.rotate(-open * 0.9);
    ctx.strokeStyle = '#9aa6b4';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-1, 0, 7, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / 6);
      poly(ctx, [{ x: -1 + Math.cos(a) * 7, y: Math.sin(a) * 7 }, { x: -1 + Math.cos(a) * 4.5, y: Math.sin(a) * 4.5 - 1 }, { x: -1 + Math.cos(a + 0.2) * 7, y: Math.sin(a + 0.2) * 7 }], '#d6dde5');
    }
    ctx.restore();
  }
}

/** Gatehouse doors swing inward between the gate pillars. */
export function drawDoors(ctx: Ctx, g: GateDef, door: GateDoor, origin: Vec, time: number): void {
  const parsed = g.edges.map((k) => k.split(':'));
  const kind = parsed[0][0];
  const nums = parsed.map((p) => (kind === 'h' ? Number(p[1]) : Number(p[2])));
  const line = Number(kind === 'h' ? parsed[0][2] : parsed[0][1]);
  const a0 = Math.min(...nums);
  const a1 = Math.max(...nums) + 1;
  const inward = kind === 'h' ? Math.sign(g.inPoint.y - line) : Math.sign(g.inPoint.x - line);
  const half = (a1 - a0) / 2;
  const shake = time - door.hitAt < 0.15 ? Math.sin(time * 80) * 1.2 : 0;
  for (const side of [0, 1]) {
    const hingeA = side ? a1 : a0;
    const dir = side ? -1 : 1;
    const ang = door.open * (Math.PI / 2) * 0.92;
    const along = Math.cos(ang) * half * dir;
    const across = Math.sin(ang) * half * inward;
    const p0 = kind === 'h' ? { x: hingeA, y: line } : { x: line, y: hingeA };
    const p1 = kind === 'h' ? { x: hingeA + along, y: line + across } : { x: line + across, y: hingeA + along };
    const s0 = rel(p0.x - origin.x, p0.y - origin.y);
    const s1 = rel(p1.x - origin.x, p1.y - origin.y);
    const H = 30;
    const broken = door.hp <= 0;
    const pts = [
      { x: s0.x + shake, y: s0.y },
      { x: s1.x + shake, y: s1.y },
      { x: s1.x + shake, y: s1.y - (broken ? 10 : H) },
      { x: s0.x + shake, y: s0.y - H },
    ];
    poly(ctx, pts, broken ? '#6e3d1e' : vGrad(ctx, s0.y - H, s0.y, '#c47e45', '#7a4524'), '#3f2412', 1.2);
    ctx.strokeStyle = '#3a3f48';
    ctx.lineWidth = 2;
    for (const k of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y - H * k);
      ctx.lineTo(pts[1].x, pts[1].y - (broken ? 10 : H) * k);
      ctx.stroke();
    }
  }
  if (door.hp < door.max) {
    const c = rel(g.outPoint.x - origin.x, g.outPoint.y - origin.y);
    fillRR(ctx, c.x - 14, c.y - 44, 28, 5, 2.5, 'rgba(20,28,40,0.7)');
    fillRR(ctx, c.x - 13, c.y - 43, 26 * Math.max(0, door.hp / door.max), 3, 1.5, '#ffb347');
  }
}

/* ---------------- Visitors and markers ---------------- */

export function sledPos(cv: Caravan): Vec {
  const f = screenDirToWorldDir(Math.cos(cv.facing), Math.sin(cv.facing));
  return { x: cv.pos.x - f.x * 1.0, y: cv.pos.y - f.y * 1.0 };
}

export function drawSled(ctx: Ctx, sx: number, sy: number, flip: number, time: number, night: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  softShadow(ctx, 0, 2, 34, 12, 0.3);
  ctx.scale(flip, 1);
  // Runners.
  ctx.strokeStyle = '#3a3f48';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, -2);
  ctx.lineTo(20, -2);
  ctx.quadraticCurveTo(28, -2, 28, -9);
  ctx.stroke();
  fillRR(ctx, -24, -16, 44, 12, 3, vGrad(ctx, -16, -4, '#c47e45', '#7a4524'), '#3f2412', 1);
  // Cargo: crates, a fur bundle, a barrel.
  fillRR(ctx, -20, -30, 14, 14, 2, vGrad(ctx, -30, -16, '#d9a26e', '#8a5230'), '#4a2a14', 1);
  fillRR(ctx, -4, -26, 12, 10, 2, vGrad(ctx, -26, -16, '#d9a26e', '#8a5230'), '#4a2a14', 1);
  ball(ctx, 13, -23, 8, 6, '#e9d8c0', '#c9b08c', '#8a7050');
  ctx.strokeStyle = '#a8693c';
  ctx.beginPath();
  ctx.moveTo(-20, -23);
  ctx.lineTo(-6, -23);
  ctx.stroke();
  fillRR(ctx, -18, -33, 10, 4, 2, '#ffffff');
  // Lantern on a pole.
  ctx.fillStyle = '#5a3420';
  ctx.fillRect(20, -44, 2, 30);
  const glow = 0.8 + Math.sin(time * 7) * 0.1;
  ball(ctx, 21, -46, 4, 5, '#fff7d6', `rgba(255,${200 + glow * 30},120,1)`, '#c98a2a');
  if (night > 0.05) ellipse(ctx, 21, -46, 16, 16, `rgba(255,190,90,${0.18 * night})`);
  ctx.restore();
}

export function drawFlare(ctx: Ctx, sx: number, sy: number, time: number): void {
  // A tall light beam visible from far away.
  const beam = ctx.createLinearGradient(sx, sy - 260, sx, sy);
  beam.addColorStop(0, 'rgba(255,80,60,0)');
  beam.addColorStop(1, 'rgba(255,90,60,0.45)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(sx - 6, sy - 16);
  ctx.lineTo(sx - 18, sy - 260);
  ctx.lineTo(sx + 18, sy - 260);
  ctx.lineTo(sx + 6, sy - 16);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  onGround(ctx, sx, sy, () => {
    const r = 0.6 + ((time * 0.8) % 1) * 0.8;
    ctx.strokeStyle = `rgba(255,90,60,${1 - ((time * 0.8) % 1)})`;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  softShadow(ctx, sx, sy, 10, 4);
  ctx.fillStyle = '#5a3420';
  ctx.fillRect(sx - 1.2, sy - 26, 2.4, 26);
  const f = Math.sin(time * 16);
  flame(ctx, sx, sy - 25, 4, 13 + f * 2, '#ff4d3d');
  flame(ctx, sx, sy - 25, 2.4, 8 + f, '#ffd0a0');
  // Abandoned supply pack.
  fillRR(ctx, sx + 6, sy - 10, 12, 10, 3, vGrad(ctx, sy - 10, sy, '#8a9a5b', '#4a5530'), '#2a3018', 1);
}

/** Translucent blueprint of a building waiting on its pad. */
export function drawGhost(ctx: Ctx, pad: Pad, sx: number, sy: number, time: number): void {
  if (!pad.ghost) return;
  const g = pad.ghost;
  const pulse = 0.5 + Math.sin(time * 3) * 0.5;
  const ratio = padShownRatio(pad);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.globalAlpha = 0.28 + pulse * 0.12 + ratio * 0.25;
  prism(ctx, 0, 0, g.w, g.d, g.h * (0.35 + ratio * 0.65), 0, {
    left: 'rgba(120,200,255,0.35)',
    right: 'rgba(80,160,230,0.35)',
    top: 'rgba(170,225,255,0.4)',
    stroke: 'rgba(220,245,255,0.95)',
  });
  ctx.restore();
}


/** Stacks on the stash deck: one small column per kind, with its count. */
export function drawStashPiles(ctx: Ctx, stash: Partial<Record<ItemKind, number>>, bumpAt: number, sx: number, sy: number, time: number, lv = 1, lvAt = -10): void {
  stashBack(ctx, sx, sy, lv, time, lvAt);
  const kinds = (Object.keys(stash) as ItemKind[]).filter((k) => (stash[k] ?? 0) > 0);
  if (!kinds.length) return;
  const sq = bumpScale(bumpAt, time);
  // Columns along the back edge of the deck, left to right.
  const slots: [number, number][] = [[-0.45, -0.45], [-0.05, -0.55], [0.35, -0.6], [-0.55, -0.05], [0.45, -0.2], [-0.5, 0.35], [0.5, 0.2]];
  kinds.slice(0, slots.length).forEach((kind, i) => {
    const n = stash[kind] ?? 0;
    const [cx, cy] = slots[i];
    const p = rel(cx, cy);
    const shown = Math.min(n, 10);
    for (let k = 0; k < shown; k++) drawItem(ctx, kind, sx + p.x, sy + p.y - 3 - k * 3.6 * sq, 1);
    const top = sy + p.y - 10 - shown * 3.6 * sq;
    ctx.font = '900 10px system-ui';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,30,45,0.85)';
    ctx.strokeText(`${n}`, sx + p.x, top);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${n}`, sx + p.x, top);
  });
}

/** Chapter 8: the Miners' Lodge, stone base, timber walls, a lantern and an ore cart. */
export function drawMineLodge(ctx: Ctx, sx: number, sy: number, time: number, builtAt: number, night: number): void {
  withBuild(ctx, builtAt, time, 50, 0.8, sx, sy, () => {
    softShadow(ctx, 5, 5, 54, 24, 0.32);
    const W = 1.5;
    const D = 1.2;
    prism(ctx, 0, 0, W + 0.1, D + 0.1, 7, 0, { left: '#8d97a3', right: '#6d7783', top: '#a9b2bd', stroke: 'rgba(40,48,60,0.5)' });
    ctx.save();
    ctx.translate(0, -7);
    logWalls(ctx, W, D, 24, '#d9a46e', '#a86c3a', '#7a4a28');
    poly(ctx, [rel(-0.22, D / 2, 0), rel(0.22, D / 2, 0), rel(0.22, D / 2, 17), rel(-0.22, D / 2, 17)], '#3f2412', '#2a160a', 1);
    windowOn(ctx, [rel(W / 2, -0.3, 9), rel(W / 2, 0.15, 9), rel(W / 2, 0.15, 17), rel(W / 2, -0.3, 17)], night);
    gableRoof(ctx, 0, 0, W, D, 23, 44, 0.16, { front: '#7d8794', back: '#5a6370', gable: '#a86c3a', snow: '#f7fbff' });
    ctx.restore();
    // Lantern on a hook by the door.
    const l = rel(0.4, D / 2 + 0.05, 24);
    const f = 0.8 + 0.2 * Math.sin(time * 7);
    ctx.globalCompositeOperation = 'lighter';
    ellipse(ctx, l.x, l.y, 10 * f, 10 * f, 'rgba(255,180,80,0.3)');
    ctx.globalCompositeOperation = 'source-over';
    ellipse(ctx, l.x, l.y, 2.4, 3, '#ffd27a');
    // Ore cart with a little gold in it.
    const c = rel(-W / 2 - 0.45, D / 2 + 0.15);
    poly(ctx, [{ x: c.x - 9, y: c.y - 9 }, { x: c.x + 9, y: c.y - 9 }, { x: c.x + 7, y: c.y - 2 }, { x: c.x - 7, y: c.y - 2 }], '#6b5444', '#3a2a1e', 0.8);
    drawItem(ctx, 'gold', c.x - 3, c.y - 10, 0.8);
    drawItem(ctx, 'ore', c.x + 3, c.y - 10, 0.8);
    ellipse(ctx, c.x - 5, c.y - 1, 2.2, 2.2, '#2a2a30');
    ellipse(ctx, c.x + 5, c.y - 1, 2.2, 2.2, '#2a2a30');
  });
}
