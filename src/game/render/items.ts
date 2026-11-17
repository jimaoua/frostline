import type { ItemKind } from '../core/types';
import { C } from './palette';
import { ellipse, fillRR, poly, vGrad } from './shapes';

type Ctx = CanvasRenderingContext2D;

export const ITEM_STEP = 4.4;
export const CASH_STEP = 3.4;

/** Draw one carried / flying item centred at (x, y), lit from the upper-left. */
export function drawItem(ctx: Ctx, kind: ItemKind, x: number, y: number, s = 1): void {
  switch (kind) {
    case 'wood': {
      fillRR(ctx, x - 7.5 * s, y - 2.8 * s, 15 * s, 5.6 * s, 2.6 * s, vGrad(ctx, y - 2.8 * s, y + 2.8 * s, '#e0a067', '#93552c'), C.woodDeep, 0.7 * s);
      ctx.strokeStyle = 'rgba(90,45,20,0.45)';
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y - 0.8 * s);
      ctx.lineTo(x + 3 * s, y - 0.8 * s);
      ctx.moveTo(x - 3 * s, y + 1.2 * s);
      ctx.lineTo(x + 4 * s, y + 1.2 * s);
      ctx.stroke();
      ellipse(ctx, x + 7 * s, y, 2.2 * s, 2.8 * s, C.logEnd);
      ellipse(ctx, x + 7 * s, y, 1.2 * s, 1.6 * s, C.logRing);
      ellipse(ctx, x + 7 * s, y, 0.4 * s, 0.5 * s, C.woodDark);
      break;
    }
    case 'stone':
    case 'ore': {
      const pts = [
        { x: x - 6.4 * s, y: y + 2.6 * s },
        { x: x - 5.4 * s, y: y - 2 * s },
        { x: x - 1 * s, y: y - 3.6 * s },
        { x: x + 5.2 * s, y: y - 2.2 * s },
        { x: x + 6.6 * s, y: y + 2.6 * s },
      ];
      poly(ctx, pts, kind === 'ore' ? '#5d6878' : C.stone, kind === 'ore' ? '#2f3744' : C.rockDark, 0.7 * s);
      poly(ctx, [pts[1], pts[2], { x: x + 1 * s, y: y - 0.6 * s }, { x: x - 3 * s, y: y + 0.2 * s }], kind === 'ore' ? '#7d8998' : C.rockLight);
      if (kind === 'ore') {
        ellipse(ctx, x + 1.8 * s, y + 0.6 * s, 1.6 * s, 1 * s, '#ffb347');
        ellipse(ctx, x - 2.2 * s, y + 1.2 * s, 1 * s, 0.7 * s, '#ffd34d');
        ellipse(ctx, x + 1.4 * s, y + 0.3 * s, 0.6 * s, 0.4 * s, '#fff3c4');
      }
      break;
    }
    case 'fish': {
      // Raw fish: silvery-blue, tail to the left.
      ctx.beginPath();
      ctx.ellipse(x + 0.8 * s, y, 6 * s, 2.8 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = vGrad(ctx, y - 3 * s, y + 3 * s, '#c8dcef', '#6f8eac');
      ctx.fill();
      ctx.strokeStyle = '#4a6582';
      ctx.lineWidth = 0.6 * s;
      ctx.stroke();
      poly(ctx, [{ x: x - 4.6 * s, y }, { x: x - 8.2 * s, y: y - 3 * s }, { x: x - 8.2 * s, y: y + 3 * s }], '#7f9dbb', '#4a6582', 0.6 * s);
      ellipse(ctx, x + 4.2 * s, y - 0.6 * s, 0.9 * s, 0.9 * s, '#1e2a38');
      ellipse(ctx, x + 1 * s, y - 1.4 * s, 3 * s, 0.7 * s, 'rgba(255,255,255,0.55)');
      break;
    }
    case 'meal': {
      // Grilled fish on a skewer: golden with char marks.
      ctx.strokeStyle = '#8d5330';
      ctx.lineWidth = 1.1 * s;
      ctx.beginPath();
      ctx.moveTo(x - 9 * s, y + 0.5 * s);
      ctx.lineTo(x + 9 * s, y - 0.5 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + 0.6 * s, y, 6 * s, 2.9 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = vGrad(ctx, y - 3 * s, y + 3 * s, '#ffcf6a', '#d07a2a');
      ctx.fill();
      ctx.strokeStyle = '#8a4a1a';
      ctx.lineWidth = 0.6 * s;
      ctx.stroke();
      poly(ctx, [{ x: x - 4.8 * s, y }, { x: x - 8 * s, y: y - 2.8 * s }, { x: x - 8 * s, y: y + 2.8 * s }], '#e09040', '#8a4a1a', 0.6 * s);
      ctx.strokeStyle = 'rgba(80,35,10,0.7)';
      ctx.lineWidth = 0.9 * s;
      for (const dx of [-2, 0.5, 3]) {
        ctx.beginPath();
        ctx.moveTo(x + (dx - 0.8) * s, y - 2 * s);
        ctx.lineTo(x + (dx + 0.8) * s, y + 2 * s);
        ctx.stroke();
      }
      ellipse(ctx, x + 1 * s, y - 1.5 * s, 2.6 * s, 0.6 * s, 'rgba(255,255,220,0.6)');
      break;
    }
    case 'salmon': {
      // Lake salmon: chunkier than pond fish, rosy flank, dark speckled back.
      ctx.beginPath();
      ctx.ellipse(x + 0.8 * s, y, 7 * s, 3.2 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = vGrad(ctx, y - 3.2 * s, y + 3.2 * s, '#5f7f94', '#f29a7e');
      ctx.fill();
      ctx.strokeStyle = '#3f5566';
      ctx.lineWidth = 0.6 * s;
      ctx.stroke();
      ellipse(ctx, x + 0.6 * s, y + 0.6 * s, 5.2 * s, 1.1 * s, 'rgba(255,170,140,0.75)');
      poly(ctx, [{ x: x - 5.4 * s, y }, { x: x - 9.2 * s, y: y - 3.4 * s }, { x: x - 8.4 * s, y }, { x: x - 9.2 * s, y: y + 3.4 * s }], '#6d8ea3', '#3f5566', 0.6 * s);
      for (const [dx, dy] of [[-2, -1.6], [0.5, -2], [2.6, -1.4], [-0.6, -1]] as const) ellipse(ctx, x + dx * s, y + dy * s, 0.45 * s, 0.4 * s, '#2a3a46');
      ellipse(ctx, x + 5 * s, y - 0.7 * s, 0.95 * s, 0.95 * s, '#1e2a38');
      ellipse(ctx, x + 5.3 * s, y - 1 * s, 0.35 * s, 0.35 * s, '#ffffff');
      break;
    }
    case 'smoked': {
      // A slatted crate of smoked fish: amber fillets peeking over the rim.
      fillRR(ctx, x - 7.5 * s, y - 3.6 * s, 15 * s, 7.2 * s, 1.2 * s, vGrad(ctx, y - 3.6 * s, y + 3.6 * s, '#c98f55', '#8a5530'), C.woodDeep, 0.7 * s);
      ctx.strokeStyle = 'rgba(90,45,20,0.55)';
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(x - 7 * s, y + 0.4 * s);
      ctx.lineTo(x + 7 * s, y + 0.4 * s);
      ctx.stroke();
      for (const dx of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.ellipse(x + dx * s, y - 3.8 * s, 2.2 * s, 1.3 * s, -0.3, 0, Math.PI * 2);
        ctx.fillStyle = vGrad(ctx, y - 5 * s, y - 2.6 * s, '#ffb35c', '#b4561f');
        ctx.fill();
        ctx.strokeStyle = '#7a3a12';
        ctx.lineWidth = 0.5 * s;
        ctx.stroke();
      }
      fillRR(ctx, x - 2.4 * s, y - 1 * s, 4.8 * s, 2.6 * s, 0.6 * s, '#f2e6c4');
      break;
    }
    case 'coin': {
      // A banded bundle of bills.
      fillRR(ctx, x - 7.5 * s, y - 2.6 * s, 15 * s, 5.2 * s, 1.2 * s, vGrad(ctx, y - 2.6 * s, y + 2.6 * s, '#7fe08a', '#2f9a3e'), C.coinDark, 0.7 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 6.5 * s, y - 2 * s, 13 * s, 0.9 * s);
      fillRR(ctx, x - 1.6 * s, y - 2.6 * s, 3.2 * s, 5.2 * s, 0.6 * s, '#f2e6c4');
      break;
    }
  }
}

/** An armful (or backpack tower) of items; sways with the walk. */
export function drawStack(ctx: Ctx, items: readonly ItemKind[], x: number, baseY: number, sway = 0, step = ITEM_STEP, squash: number | undefined = 1): void {
  squash ??= 1;
  for (let i = 0; i < items.length; i++) {
    const k = i / Math.max(1, items.length);
    drawItem(ctx, items[i], x + sway * k * k * 6, baseY - i * step * squash);
  }
}
