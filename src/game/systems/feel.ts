import type { Pad, Popup, Vec, World } from '../core/types';
import { padRatio } from './padcost';
import { popup } from './effects';

/**
 * Short-lived "game feel" state: transfer streaks, what a pad shows as paid
 * (money in flight has not landed yet), bounce timers, running tallies.
 *
 * None of this is saved: it lives in WeakMaps keyed by the world / pad, so
 * save files and the economy stay exactly as they were.
 */

interface Streak {
  n: number;
  last: number;
  /** Bill size chosen when the streak started (keeps bills a steady size). */
  chunk: number;
}

interface FeelState {
  streaks: Map<string, Streak>;
  /** Pad the player is standing on, and since when. */
  onPad: string | null;
  padSince: number;
  tally: Popup | null;
  tallySum: number;
  stackBumpAt: number;
  wasFull: boolean;
  /** Direction of the current stash visit, fixed when you step on. */
  stashMode: 'drop' | 'take' | null;
  stashSince: number;
  stashFullShown: boolean;
}

interface PadFeel {
  /** Landed amount per part (-1 = main cost), only what has actually arrived. */
  shown: Map<number, number>;
  bumpAt: number;
  /** Construction stage (0..3) last shown, and when it changed. */
  stage: number;
  stageAt: number;
}

const worlds = new WeakMap<World, FeelState>();
const pads = new WeakMap<Pad, PadFeel>();

export function feel(w: World): FeelState {
  let s = worlds.get(w);
  if (!s) {
    s = { streaks: new Map(), onPad: null, padSince: 0, tally: null, tallySum: 0, stackBumpAt: -10, wasFull: false, stashMode: null, stashSince: 0, stashFullShown: false };
    worlds.set(w, s);
  }
  return s;
}

/**
 * Consecutive transfers of the same kind speed up: the first few items go
 * one by one so you can see them, then the stream accelerates.
 * Returns the step index (0, 1, 2…) and the bill size for this streak.
 */
export function streak(w: World, key: string, startChunk: () => number): Streak {
  const st = feel(w).streaks;
  let s = st.get(key);
  if (!s || w.time - s.last > 0.35) {
    s = { n: 0, last: w.time, chunk: Math.max(1, startChunk()) };
    st.set(key, s);
  } else {
    s.n++;
    s.last = w.time;
  }
  return s;
}

/** Delay before the next item in a streak: `first`, shrinking to `min`. */
export const streakGap = (n: number, first: number, min: number, decay = 0.86) => Math.max(min, first * Math.pow(decay, n));

/** Amount of one part the pad visibly shows as paid (only what has landed). */
export function padShown(pad: Pad, index = -1): number {
  const logical = partPaid(pad, index);
  const f = pads.get(pad);
  const v = f?.shown.get(index);
  if (v === undefined) return logical;
  return Math.min(v, logical); // pad was reset (level re-arm, caravan)
}

/** Weighted 0..1 progress of what has landed on the pad. */
export const padShownRatio = (pad: Pad) => padRatio(pad, (p) => padShown(pad, p.index));

export function padFeel(pad: Pad): PadFeel {
  let f = pads.get(pad);
  if (!f) {
    f = { shown: new Map(), bumpAt: -10, stage: -1, stageAt: -10 };
    pads.set(pad, f);
  }
  return f;
}

/** Start tracking a part before its logical `paid` moves on. */
export function trackPart(pad: Pad, index: number): void {
  const f = padFeel(pad);
  if (!f.shown.has(index)) f.shown.set(index, partPaid(pad, index));
}

/** Construction stage for a 0..1 ratio: foundations, frame, walls, roof. */
export const STAGE_AT = [0.25, 0.6, 0.9] as const;
export const stageOf = (q: number) => (q >= STAGE_AT[2] ? 3 : q >= STAGE_AT[1] ? 2 : q >= STAGE_AT[0] ? 1 : 0);

/** When the site last moved up a stage (for its pop animation). */
export const padStageAt = (pad: Pad) => pads.get(pad)?.stageAt ?? -10;
export const padBumpAt = (pad: Pad) => pads.get(pad)?.bumpAt ?? -10;

const partPaid = (pad: Pad, index: number) => (index < 0 ? pad.paid : (pad.parts?.[index]?.paid ?? 0));

/** Pad squash after each landing (1 = rest). */
export function padBump(pad: Pad, time: number): number {
  const f = pads.get(pad);
  if (!f) return 1;
  const t = (time - f.bumpAt) / 0.16;
  return t >= 1 || t < 0 ? 1 : 1 + Math.sin(t * Math.PI) * 0.07;
}

export function clearPadFeel(pad: Pad): void {
  pads.delete(pad);
}

/**
 * One growing "+$123" above the player while a streak of money comes in,
 * instead of a cloud of separate numbers.
 */
export function tally(w: World, at: Vec, amount: number): void {
  const s = feel(w);
  const live = s.tally && w.popups.includes(s.tally) && s.tally.t < 0.75;
  if (!live) {
    s.tallySum = 0;
    popup(w, at, 62, '', '#9cf5a8');
    s.tally = w.popups[w.popups.length - 1];
  }
  s.tallySum += amount;
  const p = s.tally!;
  p.text = `+$${s.tallySum}`;
  p.x = at.x;
  p.y = at.y;
  p.t = Math.min(p.t, 0.12);
}

/** Squash of the stack on the player's back right after an item lands on it. */
export function stackSquash(w: World): number {
  const t = (w.time - feel(w).stackBumpAt) / 0.14;
  return t >= 1 || t < 0 ? 1 : 1 - Math.sin(t * Math.PI) * 0.1;
}

/** When each station last went up a level (its new piece pops in then). */
const levelAts = new WeakMap<World, Partial<Record<string, number>>>();
export function markLevelUp(w: World, station: string): void {
  let m = levelAts.get(w);
  if (!m) levelAts.set(w, (m = {}));
  m[station] = w.time;
}
export const levelUpAt = (w: World, station: string) => levelAts.get(w)?.[station] ?? -10;
