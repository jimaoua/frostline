import { CASH_STACK_MAX } from '../core/constants';
import type { Emote, ItemKind, Mover, Wolf } from '../core/types';
import { CASH_STEP, ITEM_STEP, drawStack } from './items';
import type { HumanStyle } from './palette';
import { ball, cylGrad, ellipse, fillRR, poly, softShadow } from './shapes';

type Ctx = CanvasRenderingContext2D;

const MOVE_EPS = 0.18;

export interface HumanOpts {
  /** Items held in the arms (front). */
  held: readonly ItemKind[];
  /** Cash on the back, in dollars. */
  cash?: number;
  swing: number;
  tool: 'axe' | 'pick' | 'rod' | null;
  showToolIdle?: boolean;
  time: number;
  full?: boolean;
  hop?: number;
  emote?: Emote;
  bump?: number;
  shiver?: boolean;
  wind?: number;
}

/** Light always comes from screen upper-left, even on a mirrored sprite. */
function lit(ctx: Ctx, flip: number, x0: number, x1: number, light: string, mid: string, dark: string): CanvasGradient {
  return flip === 1 ? cylGrad(ctx, x0, x1, light, mid, dark) : cylGrad(ctx, x1, x0, light, mid, dark);
}

/** Tool arm angle over a swing: wind-up, fast strike, follow-through, settle. */
function swingAngle(sw: number): number {
  const t = 1 - sw;
  if (t < 0.22) return -0.5 - (t / 0.22) * 2.5; // raise
  if (t < 0.45) return -3.0 + ((t - 0.22) / 0.23) * 3.35; // strike
  return 0.35 - ((t - 0.45) / 0.55) * 0.8; // settle
}

function drawTool(ctx: Ctx, tool: 'axe' | 'pick' | 'rod', tug: number): void {
  if (tool === 'rod') {
    ctx.strokeStyle = '#6b4429';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 34);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.quadraticCurveTo(4, 40 + tug * 4, 2, 46);
    ctx.stroke();
    return;
  }
  fillRR(ctx, -1, 7, 2, 15, 1, cylGrad(ctx, -1, 1, '#b07848', '#7a4a28', '#4a2a14'));
  if (tool === 'axe') {
    poly(ctx, [{ x: 0.6, y: 16 }, { x: 7.5, y: 14.2 }, { x: 8.6, y: 22 }, { x: 0.6, y: 21 }], '#a9b6c4', '#4f5b68', 0.7);
    poly(ctx, [{ x: 7.5, y: 14.2 }, { x: 8.6, y: 22 }, { x: 7, y: 21.8 }, { x: 6.1, y: 14.6 }], '#f2f6fa');
  } else {
    poly(ctx, [{ x: -8, y: 17.6 }, { x: 0, y: 19.6 }, { x: 8, y: 17.6 }, { x: 0, y: 21.6 }], '#a9b6c4', '#4f5b68', 0.7);
    poly(ctx, [{ x: 6, y: 18 }, { x: 8, y: 17.6 }, { x: 4, y: 20 }], '#f2f6fa');
  }
}

/**
 * A chibi survivor with real volume: shaded coat and head, puffy hood, scarf
 * that trails in the wind. Orientation is fully driven by Mover.facing:
 * flip handles left/right, `side` blends front ↔ profile, `away` shows the
 * back when walking up-screen, and lean tilts into the motion.
 */
export function drawHuman(ctx: Ctx, sx: number, sy: number, m: Mover, s: HumanStyle, o: HumanOpts): void {
  const speed = Math.hypot(m.vel.x, m.vel.y);
  const moving = speed > MOVE_EPS;
  const fx = Math.cos(m.facing);
  const fy = Math.sin(m.facing);
  const side = Math.min(1, Math.abs(fx) * 1.15);
  const away = fy < -0.25;
  const stride = moving ? Math.sin(m.walkPhase) : 0;
  const t = o.time + sx * 0.013;
  const breath = Math.sin(t * 2.3);
  const bob = moving ? Math.abs(Math.cos(m.walkPhase)) * 2.2 : breath * 0.5;
  const hop = (o.hop ?? 0) > 0 ? Math.sin((1 - (o.hop ?? 0)) * Math.PI) * 9 : 0;
  const shiver = o.shiver ? Math.sin(o.time * 60) * 0.7 : 0;
  // Squash & stretch: breathing when idle, a little bounce per step.
  const sq = moving ? 1 - Math.abs(Math.sin(m.walkPhase)) * 0.035 : 1 + breath * 0.022;
  const bump = o.bump ?? 0;
  const bumpSq = bump > 0 ? 1 - Math.sin(bump * Math.PI) * 0.08 : 1;

  softShadow(ctx, sx, sy, 15 - hop * 0.4, 6);
  ctx.save();
  ctx.translate(sx + shiver, sy - hop);
  ctx.rotate(m.lean);
  ctx.scale(m.flip * (2 - sq * bumpSq), sq * bumpSq);
  const F = m.flip;

  const holding = o.held.length > 0;
  const backX = -3 - side * 9;
  const cashBundles = Math.min(CASH_STACK_MAX, Math.ceil((o.cash ?? 0) / 10));
  const cash: ItemKind[] = Array(cashBundles).fill('coin');
  const sway = moving ? Math.sin(m.walkPhase - 0.6) * 1.2 : breath * 0.25;
  const frontX = 3 + side * 8;
  const frontBase = -16 - bob;

  // Behind the body: cash backpack (facing camera) or armful (facing away).
  if (!away && cash.length) drawStack(ctx, cash, backX, -20 - bob, -sway, CASH_STEP);
  if (away && holding) drawStack(ctx, o.held, frontX, frontBase, -sway);

  // Legs with chunky boots.
  for (const leg of [-1, 1]) {
    const lx = (1 - side) * leg * 3.8 + side * leg * stride * 4.8;
    const lift = Math.max(0, leg * stride) * 2.6;
    fillRR(ctx, lx - 2.8, -11 - lift, 5.6, 10, 2.4, lit(ctx, F, lx - 2.8, lx + 2.8, '#4a5b78', s.pants, '#1d2638'));
    ball(ctx, lx + side * 1.4, -1.8 - lift, 3.8, 2.4, '#6b5244', s.boots, '#1a120d');
  }

  const armSwing = moving ? -stride * 0.7 : 0.12 + breath * 0.04;
  const shoulderY = -26 - bob;

  // Back arm.
  if (side > 0.35 && !holding) {
    ctx.save();
    ctx.translate(-1.5, shoulderY);
    ctx.rotate(-armSwing);
    fillRR(ctx, -2.6, -1, 5.2, 11, 2.6, s.coatDark);
    ctx.restore();
  }

  // Scarf tail streaming behind.
  if (s.scarf) {
    const flap = Math.sin(o.time * 9 + sx) * 2 + (o.wind ?? 0) * 2;
    ctx.fillStyle = s.scarf;
    ctx.beginPath();
    ctx.moveTo(-3, shoulderY + 1);
    ctx.quadraticCurveTo(-10 - speed * 2, shoulderY + 3 + flap, -15 - speed * 3, shoulderY + 1 + flap * 1.5);
    ctx.lineTo(-14 - speed * 3, shoulderY + 6 + flap);
    ctx.quadraticCurveTo(-9, shoulderY + 7, -2, shoulderY + 5);
    ctx.closePath();
    ctx.fill();
  }

  // Coat: a puffy bell shape with volume shading.
  const bw = 19 - side * 4;
  const top = -32 - bob;
  const hem = -9 - bob * 0.3;
  ctx.beginPath();
  ctx.moveTo(-bw * 0.42, top + 2);
  ctx.quadraticCurveTo(-bw * 0.58, (top + hem) / 2, -bw * 0.56, hem);
  ctx.quadraticCurveTo(0, hem + 3, bw * 0.56, hem);
  ctx.quadraticCurveTo(bw * 0.58, (top + hem) / 2, bw * 0.42, top + 2);
  ctx.quadraticCurveTo(0, top - 3, -bw * 0.42, top + 2);
  ctx.closePath();
  ctx.fillStyle = lit(ctx, F, -bw / 2, bw / 2, s.coatLight, s.coat, s.coatDark);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,48,0.35)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // Quilted puffer seams.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (const yy of [top + 8, top + 14]) {
    ctx.beginPath();
    ctx.moveTo(-bw * 0.5, yy);
    ctx.quadraticCurveTo(0, yy + 2, bw * 0.5, yy);
    ctx.stroke();
  }
  fillRR(ctx, -bw * 0.6, hem - 3.5, bw * 1.2, 5, 2.4, lit(ctx, F, -bw * 0.6, bw * 0.6, '#ffffff', s.trim, '#c9d2dc'));
  if (!away) {
    const zx = side * bw * 0.28;
    ctx.strokeStyle = s.coatDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(zx, top + 6);
    ctx.lineTo(zx, hem - 3);
    ctx.stroke();
    ellipse(ctx, zx + 1.6, top + 10, 1, 1, s.trim);
    ellipse(ctx, zx + 1.6, top + 15, 1, 1, s.trim);
  }
  if (s.scarf) fillRR(ctx, -bw * 0.45, top - 1, bw * 0.9, 4.5, 2.2, s.scarf);

  // Head.
  const hx = side * 1.8;
  const hy = -40 - bob;
  if (s.hatType === 'hood') {
    ball(ctx, hx - side * 1.5, hy, 12, 11.2, s.coatLight, s.hat, s.coatDark);
    if (away) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 10);
      ctx.lineTo(hx, hy + 9);
      ctx.stroke();
    } else {
      const fcx = hx + side * 2.8;
      ball(ctx, fcx, hy + 1, 9.6, 9.3, '#ffffff', s.trim, '#c3ccd8');
      drawFace(ctx, fcx + side * 0.8, hy + 1.6, side, fy, s.skin, 7.2, o.emote, hop > 0);
    }
  } else if (away) {
    ball(ctx, hx, hy + 1, 9, 9, '#8a5a3a', s.hair, '#2a1a10');
  } else {
    drawFace(ctx, hx + side * 1.5, hy + 1, side, fy, s.skin, 9, o.emote, hop > 0);
    if (s.hatType === 'bare') {
      ctx.beginPath();
      ctx.ellipse(hx, hy - 3, 9.4, 7, 0, Math.PI, 0);
      ctx.fillStyle = s.hair;
      ctx.fill();
    }
  }
  drawHat(ctx, s, hx, hy, side, away);

  if (away && cash.length) drawStack(ctx, cash, backX, -20 - bob, -sway, CASH_STEP);

  // Arms: carry pose when holding, tool swing otherwise.
  if (holding) {
    for (const k of [0, 1]) {
      ctx.save();
      ctx.translate(k ? 1 + side * 2 : -3, shoulderY + 1);
      ctx.rotate(-1.15 + k * 0.1 + (moving ? Math.sin(m.walkPhase) * 0.05 : 0));
      fillRR(ctx, -2.7, -1, 5.4, 11, 2.7, k ? s.coat : s.coatDark);
      ball(ctx, 0, 10.5, 3.1, 3.1, s.coatLight, s.coatDark, '#1a2433');
      ctx.restore();
    }
    if (!away) drawStack(ctx, o.held, frontX, frontBase, sway);
  } else {
    const acting = o.swing > 0.01;
    let ang = armSwing;
    if (o.tool === 'rod') ang = -1.9 - (acting ? Math.sin(o.swing * Math.PI) * 0.5 : Math.sin(o.time * 1.5) * 0.05);
    else if (acting) ang = swingAngle(o.swing);
    ctx.save();
    ctx.translate(1.5 + side * 2, shoulderY);
    ctx.rotate(ang);
    if (o.tool && (acting || o.showToolIdle || o.tool === 'rod')) drawTool(ctx, o.tool, o.swing);
    fillRR(ctx, -2.8, -1, 5.6, 11.5, 2.8, lit(ctx, F, -2.8, 2.8, s.coatLight, s.coat, s.coatDark));
    ball(ctx, 0, 11, 3.2, 3.2, s.coatLight, s.coatDark, '#1a2433');
    ctx.restore();
  }

  ctx.restore();

  const topY = sy - hop - 58;
  if (o.emote) drawEmote(ctx, sx, topY, o.emote, o.time);
  if (o.full && holding) {
    const tx = sx + F * frontX;
    const ty = sy - hop + frontBase - o.held.length * ITEM_STEP - 10;
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(20,30,45,0.9)';
    ctx.strokeText('MAX', tx, ty);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('MAX', tx, ty);
  }
}

function drawFace(ctx: Ctx, cx: number, cy: number, side: number, fy: number, skin: string, r: number, emote: Emote | undefined, cheer: boolean): void {
  ball(ctx, cx, cy, r, r * 0.97, '#ffe3cc', skin, '#d79b78');
  const ey = cy - r * 0.08 + (fy > 0.5 ? 0.6 : 0);
  const happy = cheer || emote === 'heart' || emote === 'happy';
  const eye = (x: number) => {
    if (happy) {
      ctx.strokeStyle = '#2a2320';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, ey + 0.8, 1.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      return;
    }
    ellipse(ctx, x, ey, 1.25, 1.6, '#2a2320');
    ellipse(ctx, x + 0.45, ey - 0.6, 0.45, 0.45, '#ffffff');
  };
  if (side > 0.75) eye(cx + r * 0.5);
  else {
    const sp = r * 0.38 * (1 - side * 0.45);
    const off = side * r * 0.27;
    eye(cx + off - sp);
    eye(cx + off + sp);
  }
  ctx.globalAlpha = 0.4;
  ellipse(ctx, cx + side * r * 0.2 - r * 0.45 * (1 - side), cy + r * 0.36, 1.9, 1.1, '#ff7a7a');
  ellipse(ctx, cx + side * r * 0.2 + r * 0.45, cy + r * 0.36, 1.9, 1.1, '#ff7a7a');
  ctx.globalAlpha = 1;
  if (happy || emote === 'cold') {
    ctx.strokeStyle = '#7a3a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (happy) ctx.arc(cx + side * r * 0.3, cy + r * 0.38, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
    else {
      ctx.moveTo(cx + side * r * 0.3 - 1.4, cy + r * 0.5);
      ctx.lineTo(cx + side * r * 0.3 + 1.4, cy + r * 0.45);
    }
    ctx.stroke();
  }
}

function drawHat(ctx: Ctx, s: HumanStyle, hx: number, hy: number, side: number, away: boolean): void {
  switch (s.hatType) {
    case 'hood':
      ball(ctx, hx - side * 2.5, hy - 11.5, 3.6, 3.6, '#ffffff', s.trim, '#c3ccd8');
      break;
    case 'beanie':
      ctx.beginPath();
      ctx.ellipse(hx, hy - 2.5, 9.6, 8.8, 0, Math.PI, 0);
      ctx.fillStyle = cylGrad(ctx, hx - 9, hx + 9, s.coatLight === s.hat ? s.hat : '#ff8a7a', s.hat, '#5a1a14');
      ctx.fill();
      fillRR(ctx, hx - 9.8, hy - 4.2, 19.6, 4, 2, s.trim);
      ball(ctx, hx, hy - 12, 3.2, 3.2, '#ffffff', s.trim, '#c3ccd8');
      break;
    case 'helmet':
      ctx.beginPath();
      ctx.ellipse(hx, hy - 2.5, 10, 8.8, 0, Math.PI, 0);
      ctx.fillStyle = cylGrad(ctx, hx - 10, hx + 10, '#ffe08a', s.hat, '#a87a14');
      ctx.fill();
      ellipse(ctx, hx, hy - 2.5, 11.4, 2, '#c99a24');
      if (!away) {
        ball(ctx, hx + 1 + side * 5, hy - 6.5, 2.6, 2.6, '#ffffff', '#fff6c2', '#e8c24a');
      }
      break;
    case 'cap':
      ctx.beginPath();
      ctx.ellipse(hx, hy - 2.5, 9.4, 8.2, 0, Math.PI, 0);
      ctx.fillStyle = cylGrad(ctx, hx - 9, hx + 9, '#4fa07a', s.hat, '#1a4a32');
      ctx.fill();
      if (!away) ellipse(ctx, hx + 2 + side * 5.5, hy - 2.8, 5.5 + side, 1.9, s.coatDark);
      break;
    case 'chef':
      fillRR(ctx, hx - 7.5, hy - 9, 15, 6, 2, '#f6f6f2');
      ball(ctx, hx - 4, hy - 13, 5, 4.6, '#ffffff', '#f2f2ee', '#c9ccd2');
      ball(ctx, hx + 4, hy - 13, 5, 4.6, '#ffffff', '#f2f2ee', '#c9ccd2');
      ball(ctx, hx, hy - 15.5, 5.4, 5, '#ffffff', '#f6f6f2', '#c9ccd2');
      break;
    case 'bare':
      break;
  }
}

export function drawEmote(ctx: Ctx, x: number, y: number, e: Emote, time: number): void {
  if (!e) return;
  const bob = Math.sin(time * 5) * 1.5;
  ctx.save();
  ctx.translate(x, y + bob);
  // Speech bubble.
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(30,40,60,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  poly(ctx, [{ x: -3, y: 7 }, { x: 3, y: 7 }, { x: -1, y: 12 }], 'rgba(255,255,255,0.95)');
  switch (e) {
    case 'heart':
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(0, 4.5);
      ctx.bezierCurveTo(-7, -1, -3, -7, 0, -2.6);
      ctx.bezierCurveTo(3, -7, 7, -1, 0, 4.5);
      ctx.fill();
      break;
    case 'happy':
      ctx.strokeStyle = '#e8a000';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0.5, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    case 'cold':
      ctx.strokeStyle = '#4aa3ff';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5);
        ctx.lineTo(-Math.cos(a) * 5.5, -Math.sin(a) * 5.5);
        ctx.stroke();
      }
      break;
    case 'alarm':
      ctx.fillStyle = '#ff4d3d';
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 0.5);
      break;
    case 'zzz':
      ctx.fillStyle = '#5a6a88';
      ctx.font = '800 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('z z', 0, 0.5);
      break;
  }
  ctx.restore();
}

/** Side-view wolf with shaded fur: flips with direction, pitches with screen heading. */
export function drawWolf(ctx: Ctx, sx: number, sy: number, wolf: Wolf, time: number): void {
  if (wolf.species === 'bear') return drawBear(ctx, sx, sy, wolf, time);
  const moving = Math.hypot(wolf.vel.x, wolf.vel.y) > MOVE_EPS;
  const stride = moving ? Math.sin(wolf.walkPhase * 1.3) : 0;
  const fy = Math.sin(wolf.facing);
  const breath = moving ? 0 : Math.sin(time * 3) * 0.4;

  softShadow(ctx, sx, sy, 17, 6);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(wolf.lean * 0.6);
  ctx.scale(wolf.flip, 1);
  ctx.rotate(fy * 0.16);
  ctx.translate(wolf.lunge * 5, wolf.stunT > 0 ? 2 : 0);
  const F = wolf.flip;

  const fur = '#7d8794';
  const furDark = '#4f5864';
  const legs: [number, number][] = [[-8, 1], [-4, -1], [5, -1], [9, 1]];
  for (const [lx, sgn] of legs) fillRR(ctx, lx + stride * sgn * 2.8 - 1.4, -10, 2.8, 10, 1.3, sgn > 0 ? furDark : fur);

  ctx.strokeStyle = fur;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.quadraticCurveTo(-17, -15, -21, -20 + Math.sin(time * 7) * 1.8);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.beginPath();
  ctx.ellipse(0, -14 + breath, 13.5, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = lit(ctx, F, -13, 13, '#a9b2bd', fur, furDark);
  ctx.fill();
  ellipse(ctx, 1, -10.5, 9, 3.2, '#d6dde5');
  ball(ctx, 12, -18.5, 6.4, 5.6, '#a9b2bd', fur, furDark);
  poly(ctx, [{ x: 15, y: -20.5 }, { x: 22.5, y: -17.2 }, { x: 15, y: -14.6 }], fur);
  ellipse(ctx, 22, -17.3, 1.5, 1.3, '#1e1a18');
  poly(ctx, [{ x: 8.5, y: -21.5 }, { x: 10.2, y: -28.5 }, { x: 12.8, y: -22.5 }], furDark);
  poly(ctx, [{ x: 11.8, y: -22.8 }, { x: 14, y: -29 }, { x: 15.4, y: -21.8 }], fur);
  ellipse(ctx, 14.6, -19.6, 1.3, 1.1, '#ffcf4a');
  ellipse(ctx, 14.9, -19.9, 0.4, 0.4, '#ffffff');

  if (wolf.hurtT > 0) {
    ctx.globalAlpha = Math.min(0.85, wolf.hurtT * 5);
    ellipse(ctx, 0, -14, 13.5, 7, '#ffffff');
    ellipse(ctx, 12, -18.5, 6.4, 5.6, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  hpBar(ctx, sx, sy - 38, wolf);
  if (wolf.stunT > 0) stars(ctx, sx, sy - 34, time);
}

function drawBear(ctx: Ctx, sx: number, sy: number, b: Wolf, time: number): void {
  const moving = Math.hypot(b.vel.x, b.vel.y) > MOVE_EPS;
  const stride = moving ? Math.sin(b.walkPhase * 1.1) : 0;
  const fy = Math.sin(b.facing);
  const breath = Math.sin(time * 2) * 0.8;

  softShadow(ctx, sx, sy, 26, 9, 0.32);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(b.flip, 1);
  ctx.rotate(fy * 0.12);
  ctx.translate(b.lunge * 6, 0);
  const F = b.flip;
  const fur = '#6b4a35';
  const furDark = '#3d281b';
  const furLight = '#9a7254';
  const legs: [number, number][] = [[-12, 1], [-6, -1], [7, -1], [13, 1]];
  for (const [lx, sgn] of legs) fillRR(ctx, lx + stride * sgn * 3 - 3, -14, 6, 14, 2.6, sgn > 0 ? furDark : fur);
  ctx.beginPath();
  ctx.ellipse(0, -21 + breath, 20, 12.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = lit(ctx, F, -20, 20, furLight, fur, furDark);
  ctx.fill();
  // Snow dusting on the back.
  ctx.beginPath();
  ctx.ellipse(-3, -30 + breath, 12, 3.5, -0.1, Math.PI, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ball(ctx, 18, -25, 9, 8, furLight, fur, furDark);
  ball(ctx, 25, -22.5, 4.6, 3.6, '#c49a78', '#a77a58', '#6b4a35');
  ellipse(ctx, 28.5, -23.4, 1.8, 1.5, '#1e1a18');
  ball(ctx, 13.5, -32, 3, 3, furLight, fur, furDark);
  ball(ctx, 20.5, -32.5, 3, 3, furLight, fur, furDark);
  ellipse(ctx, 21, -26.5, 1.2, 1.2, '#1e1a18');
  ellipse(ctx, 21.4, -26.9, 0.4, 0.4, '#ffffff');
  if (b.hurtT > 0) {
    ctx.globalAlpha = Math.min(0.85, b.hurtT * 5);
    ellipse(ctx, 0, -21, 20, 12.5, '#ffffff');
    ellipse(ctx, 18, -25, 9, 8, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  hpBar(ctx, sx, sy - 50, b);
  if (b.stunT > 0) stars(ctx, sx, sy - 46, time);
}

function hpBar(ctx: Ctx, x: number, y: number, m: Wolf): void {
  if (m.hp >= m.maxHp) return;
  const w = m.species === 'bear' ? 34 : 24;
  fillRR(ctx, x - w / 2 - 1, y - 1, w + 2, 5, 2.5, 'rgba(20,28,40,0.7)');
  fillRR(ctx, x - w / 2, y, w * Math.max(0, m.hp / m.maxHp), 3, 1.5, '#ff6b5a');
}

function stars(ctx: Ctx, x: number, y: number, time: number): void {
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + (i / 3) * Math.PI * 2;
    ctx.fillStyle = '#ffe58a';
    ctx.font = '900 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', x + Math.cos(a) * 9, y + Math.sin(a) * 3);
  }
}

