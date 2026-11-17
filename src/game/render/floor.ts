import { FIRE_WOOD_REQUIRED } from '../core/constants';
import { clamp, easeOutBack } from '../core/math';
import type { Pad, PadIcon, World } from '../core/types';
import type { Rect } from '../world/layout';
import { padBump, padShown } from '../systems/feel';
import { drawItem } from './items';
import { onGround, roundRectPath } from './shapes';

type Ctx = CanvasRenderingContext2D;

function icon(ctx: Ctx, kind: PadIcon | 'lock'): void {
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (kind) {
    case 'hut':
    case 'home':
      ctx.moveTo(-10, 9);
      ctx.lineTo(-10, -2);
      ctx.lineTo(0, -10);
      ctx.lineTo(10, -2);
      ctx.lineTo(10, 9);
      ctx.closePath();
      ctx.stroke();
      if (kind === 'home') {
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.bezierCurveTo(-6, 1, -3, -4, 0, -0.5);
        ctx.bezierCurveTo(3, -4, 6, 1, 0, 6);
        ctx.fill();
      } else ctx.fillRect(-3, 2, 6, 7);
      break;
    case 'expand':
      for (const s of [-1, 1]) {
        ctx.moveTo(s * 3, 0);
        ctx.lineTo(s * 12, 0);
        ctx.moveTo(s * 8, -4.5);
        ctx.lineTo(s * 12, 0);
        ctx.lineTo(s * 8, 4.5);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.stroke();
      break;
    case 'trade':
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '900 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      break;
    case 'pick':
      ctx.moveTo(-8, 10);
      ctx.lineTo(6, -6);
      ctx.moveTo(-6, -10);
      ctx.quadraticCurveTo(4, -12, 12, -2);
      ctx.stroke();
      break;
    case 'tower':
      ctx.moveTo(-7, 10);
      ctx.lineTo(-5, -4);
      ctx.lineTo(5, -4);
      ctx.lineTo(7, 10);
      ctx.moveTo(-9, -4);
      ctx.lineTo(0, -12);
      ctx.lineTo(9, -4);
      ctx.stroke();
      break;
    case 'gear':
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
      break;
    case 'trap':
      ctx.arc(0, 2, 9, Math.PI, 0);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-8 + i * 4, 2);
        ctx.lineTo(-6 + i * 4, -3);
        ctx.stroke();
      }
      break;
    case 'gate':
      ctx.rect(-10, -8, 20, 16);
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 8);
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      break;
    case 'pack':
      ctx.rect(-8, -6, 16, 15);
      ctx.moveTo(-4, -6);
      ctx.quadraticCurveTo(0, -13, 4, -6);
      ctx.moveTo(-8, 1);
      ctx.lineTo(8, 1);
      ctx.stroke();
      break;
    case 'arrow':
      ctx.moveTo(-10, 10);
      ctx.lineTo(9, -9);
      ctx.moveTo(1, -10);
      ctx.lineTo(10, -10);
      ctx.lineTo(10, -1);
      ctx.moveTo(-10, 4);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-4, 10);
      ctx.stroke();
      break;
    case 'person':
      ctx.arc(0, -5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 10, 9, Math.PI, 0);
      ctx.fill();
      break;
    case 'fish':
      ctx.ellipse(1, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.moveTo(-8, 0);
      ctx.lineTo(-13, -5);
      ctx.lineTo(-13, 5);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'lock':
      ctx.rect(-8, -2, 16, 12);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -3, 5.5, Math.PI, 0);
      ctx.stroke();
      break;
    case 'fire':
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(9, -2, 6, 6);
      ctx.quadraticCurveTo(0, 12, -6, 6);
      ctx.quadraticCurveTo(-9, -2, 0, -12);
      ctx.fill();
      break;
    case 'grill':
      ctx.rect(-10, -3, 20, 9);
      ctx.moveTo(-10, -3);
      ctx.lineTo(10, -3);
      for (let i = -6; i <= 6; i += 4) {
        ctx.moveTo(i, -8);
        ctx.quadraticCurveTo(i + 3, -11, i, -14);
      }
      ctx.stroke();
      break;
  }
  ctx.lineCap = 'butt';
}

/** Can the player finish (or at least feed) this pad right now? */
export function padAffordance(w: World, pad: Pad): 'locked' | 'none' | 'some' | 'all' {
  if (pad.locked) return 'locked';
  const remaining = pad.cost.amount - pad.paid;
  const have = pad.cost.kind === 'coin' ? w.coins : w.player.carry.filter((c) => c === pad.cost.kind).length;
  return have <= 0 ? 'none' : have >= remaining ? 'all' : 'some';
}

/**
 * Purchase pad painted onto the ground: a big dark tile with a thick marching
 * border, a progress fill and the price printed huge on the floor. Locked
 * "next unlock" pads are grey and still.
 */
export function drawPad(ctx: Ctx, w: World, pad: Pad, sx: number, sy: number): void {
  const t = clamp((w.time - pad.activatedAt) / 0.5, 0, 1);
  const s = Math.max(0.01, easeOutBack(t));
  const state = padAffordance(w, pad);
  const locked = state === 'locked';
  const p = w.player.pos;
  const on = !locked && Math.abs(p.x - pad.pos.x) < pad.size / 2 && Math.abs(p.y - pad.pos.y) < pad.size / 2;
  onGround(ctx, sx, sy, () => {
    const bs = padBump(pad, w.time);
    ctx.scale((s * bs) / 32, (s * (2 - bs)) / 32);
    const half = pad.size * 16 * (on ? 1.06 : 1);
    if (state === 'all' || on) {
      const pulse = 0.5 + Math.sin(w.time * 6) * 0.5;
      roundRectPath(ctx, -half - 6, -half - 6, half * 2 + 12, half * 2 + 12, 12);
      ctx.strokeStyle = `rgba(255,214,77,${0.45 + pulse * 0.55})`;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    roundRectPath(ctx, -half, -half, half * 2, half * 2, 9);
    ctx.fillStyle = locked ? 'rgba(70,80,96,0.45)' : 'rgba(26,34,48,0.78)';
    ctx.fill();
    const ratio = padShown(pad) / pad.cost.amount;
    if (ratio > 0 && !locked) {
      ctx.save();
      ctx.clip();
      const g = ctx.createLinearGradient(0, half, 0, -half);
      g.addColorStop(0, 'rgba(60,200,105,0.95)');
      g.addColorStop(1, 'rgba(150,245,170,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(-half, half - half * 2 * ratio, half * 2, half * 2 * ratio);
      ctx.restore();
    }
    roundRectPath(ctx, -half + 4, -half + 4, half * 2 - 8, half * 2 - 8, 6);
    ctx.strokeStyle = locked ? 'rgba(255,255,255,0.45)' : state === 'all' ? '#ffd64d' : '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.setLineDash(locked ? [4, 6] : [9, 5]);
    ctx.lineDashOffset = locked ? 0 : -w.time * 18;
    ctx.stroke();
    ctx.setLineDash([]);

  });
}

/** Text for a pad requirement: "150" for cash, "6/10" for materials. */
export function padQuantity(pad: Pad): string {
  const shown = padShown(pad);
  return pad.cost.kind === 'coin' ? `${pad.cost.amount - shown}` : `${shown}/${pad.cost.amount}`;
}

/**
 * The pad's requirement indicator: one huge resource icon and the quantity,
 * standing upright on the pad so it never shears with the floor. No names or
 * descriptions; those live in the mission card.
 */
export function drawPadBadge(ctx: Ctx, w: World, pad: Pad, sx: number, sy: number, scale: number): void {
  const state = padAffordance(w, pad);
  const locked = state === 'locked';
  const appear = Math.max(0.01, easeOutBack(clamp((w.time - pad.activatedAt) / 0.5, 0, 1)));
  const pulse = (state === 'all' ? 1 + Math.sin(w.time * 7) * 0.07 : 1) * padBump(pad, w.time);
  const text = padQuantity(pad);
  ctx.save();
  ctx.translate(sx, sy - 6);
  ctx.scale((appear * pulse) / scale, (appear * pulse) / scale);

  const FONT = '900 34px system-ui, -apple-system, "SF Pro Rounded", sans-serif';
  ctx.font = FONT;
  const tw = ctx.measureText(text).width;
  const iconW = 40;
  const gap = 6;
  const W = iconW + gap + tw;
  const x0 = -W / 2;

  // Soft dark plate behind for contrast on bright snow and dark nights alike.
  roundRectPath(ctx, x0 - 12, -27, W + 24, 54, 27);
  ctx.fillStyle = locked ? 'rgba(40,48,60,0.55)' : state === 'all' ? 'rgba(90,50,0,0.45)' : 'rgba(10,16,26,0.55)';
  ctx.fill();
  if (state === 'all') {
    ctx.strokeStyle = `rgba(255,214,77,${0.6 + Math.sin(w.time * 7) * 0.4})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Icon: drawn big, with a ring showing partial payment.
  const ix = x0 + iconW / 2;
  ctx.globalAlpha = locked ? 0.6 : 1;
  ctx.beginPath();
  ctx.arc(ix, 0, 19, 0, Math.PI * 2);
  ctx.fillStyle = state === 'all' ? '#ffe9a0' : '#ffffff';
  ctx.fill();
  const ratio = padShown(pad) / pad.cost.amount;
  if (ratio > 0 && !locked) {
    ctx.beginPath();
    ctx.arc(ix, 0, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.strokeStyle = '#2fbf5f';
    ctx.lineWidth = 4.5;
    ctx.stroke();
  }
  drawItem(ctx, pad.cost.kind, ix, 0, 1.75);
  if (locked) {
    ctx.save();
    ctx.translate(ix + 13, 12);
    ctx.scale(0.5, 0.5);
    ctx.fillStyle = '#3a4352';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    icon(ctx, 'lock');
    ctx.restore();
  }

  // Quantity: heavy, outlined, high contrast.
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(8,12,20,0.95)';
  const tx = x0 + iconW + gap;
  ctx.strokeText(text, tx, 2);
  const fill = ctx.createLinearGradient(0, -16, 0, 18);
  if (locked) {
    fill.addColorStop(0, '#e2e7ee');
    fill.addColorStop(1, '#a9b3c1');
  } else if (state === 'all') {
    fill.addColorStop(0, '#fff6c4');
    fill.addColorStop(1, '#ffc93d');
  } else if (state === 'none') {
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#ffb3a8');
  } else {
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#d8e6f5');
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, tx, 2);

  // Level pads: a green "▲ LV 2" tag so upgrades read at a glance.
  if (pad.level) {
    const tag = `▲ LV ${pad.level}`;
    ctx.font = '900 20px system-ui, -apple-system, sans-serif';
    const lw = ctx.measureText(tag).width + 20;
    roundRectPath(ctx, -lw / 2, -58, lw, 28, 14);
    ctx.fillStyle = locked ? '#6b7686' : '#2fbf5f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,20,0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(tag, 0, -43);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Highlighted construction zone for a stockade expansion. */
export function drawExpandZone(ctx: Ctx, r: Rect, time: number): void {
  onGround(ctx, 0, 0, () => {
    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    ctx.fillStyle = `rgba(120,200,255,${0.1 + pulse * 0.08})`;
    ctx.fillRect(r.x + 0.1, r.y + 0.1, r.w - 0.2, r.h - 0.2);
    ctx.strokeStyle = `rgba(200,240,255,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 0.07;
    ctx.setLineDash([0.3, 0.2]);
    ctx.lineDashOffset = -time * 0.5;
    ctx.strokeRect(r.x + 0.1, r.y + 0.1, r.w - 0.2, r.h - 0.2);
    ctx.setLineDash([]);
  });
}

/** Ground ring around the unlit campfire showing fuel progress (phase 1). */
export function drawFireRing(ctx: Ctx, w: World, sx: number, sy: number): void {
  const ratio = w.fire.fuel / FIRE_WOOD_REQUIRED;
  const hasWood = w.player.carry.includes('wood');
  const pulse = hasWood ? 0.5 + Math.sin(w.time * 5) * 0.5 : 0;
  onGround(ctx, sx, sy, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 1.25, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,200,120,${0.12 + pulse * 0.14})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.08;
    ctx.setLineDash([0.2, 0.13]);
    ctx.lineDashOffset = -w.time * 0.3;
    ctx.stroke();
    ctx.setLineDash([]);
    if (ratio > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 1.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.strokeStyle = '#ffae3b';
      ctx.lineWidth = 0.18;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  });
}

/** Warm ring around the fire during a blizzard: the safe zone. */
export function drawWarmZone(ctx: Ctx, sx: number, sy: number, radius: number, time: number): void {
  onGround(ctx, sx, sy, () => {
    const pulse = 0.5 + Math.sin(time * 4) * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,170,80,${0.12 + pulse * 0.08})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,200,120,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 0.08;
    ctx.setLineDash([0.25, 0.15]);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}
