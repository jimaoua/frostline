import type { ItemKind, Pad, World } from '../core/types';

/**
 * A pad's price as a list of parts. Part -1 is the pad's main `cost`/`paid`
 * (kept for old saves and everything that reads them); parts 0..n are the
 * extra materials in `pad.parts`. Materials are listed first, money last, so
 * the player always unloads what they carry before their wallet.
 */
export interface PartView {
  index: number;
  kind: ItemKind;
  amount: number;
  paid: number;
}

export function padParts(pad: Pad): PartView[] {
  const list: PartView[] = (pad.parts ?? []).map((p, i) => ({ index: i, kind: p.kind, amount: p.amount, paid: p.paid }));
  const main: PartView = { index: -1, kind: pad.cost.kind, amount: pad.cost.amount, paid: pad.paid };
  if (main.kind === 'coin') list.push(main);
  else list.unshift(main);
  return list;
}

export function addPaid(pad: Pad, index: number, n: number): void {
  if (index < 0) pad.paid += n;
  else if (pad.parts?.[index]) pad.parts[index].paid += n;
}

export const isMulti = (pad: Pad) => (pad.parts?.length ?? 0) > 0;

/** Every part fully handed over (items may still be in the air). */
export function padFullyPaid(pad: Pad): boolean {
  return padParts(pad).every((p) => p.paid >= p.amount);
}

/** Effort per unit, so a log weighs more than a dollar when showing progress. */
const WEIGHT: Partial<Record<ItemKind, number>> = { coin: 1, wood: 4, stone: 6, ore: 15 };
export const partWeight = (kind: ItemKind) => WEIGHT[kind] ?? 4;

/** Weighted 0..1 progress, with `paidOf` choosing logical or landed amounts. */
export function padRatio(pad: Pad, paidOf: (p: PartView) => number = (p) => p.paid): number {
  let done = 0;
  let total = 0;
  for (const p of padParts(pad)) {
    const wgt = partWeight(p.kind);
    done += Math.min(p.amount, paidOf(p)) * wgt;
    total += p.amount * wgt;
  }
  return total > 0 ? done / total : 1;
}


/** How many of a material the open construction pads still need (minus what the player carries). */
export function openNeed(w: World, kind: ItemKind): number {
  let need = 0;
  for (const pad of Object.values(w.pads)) {
    if (!pad.active || pad.completed) continue;
    for (const p of padParts(pad)) if (p.kind === kind) need += Math.max(0, p.amount - p.paid);
  }
  const carried = w.player.carry.filter((c) => c === kind).length;
  return Math.max(0, need - carried);
}

/** Stock the hauler may sell: anything beyond what open pads are waiting for. */
export const surplus = (w: World, kind: 'wood' | 'stone') => Math.max(0, w.stock[kind] - openNeed(w, kind));
