import { COOK_TIME, FISH_INTERVAL, MEAL_PRICE, SMOKE_TIME } from '../core/constants';
import type { Pad, PadPart, StationId, StructureId, Vec, World } from '../core/types';
import { markLevelUp } from './feel';
import { burst, celebrate, popup, ring, sfx } from './effects';

/**
 * Two small loops that keep players coming back for "one more":
 *  - Station levels: every station has its own upgrade pad that re-opens at a
 *    higher price after each purchase, so there is always something to buy.
 *  - Camp level: XP from missions, meals, builds and wolves; every level-up
 *    pays a cash reward (and a bigger pack every third level, up to level 12).
 */

export const STATION_MAX = 4;

/** The building that shows each station's level. */
const STATION_STRUCTURE: Record<StationId, StructureId> = {
  grill: 'grill',
  hatch: 'counter',
  fishing: 'fishPond',
  lumber: 'lumberHut',
  smoke: 'smokehouse',
  stash: 'stash',
};

/** Cost multiplier for each further station level. */
const LEVEL_COST_GROWTH = 2.1;

/** Money price of a station's Lv2 (its pad's starting price). */
const LEVEL_BASE: Record<StationId, number> = { grill: 40, hatch: 90, fishing: 120, lumber: 150, smoke: 400, stash: 120 };

/** What the stash holds at each level (items of any kind, never money). */
export const STASH_CAPACITY = [0, 30, 60, 100, 160] as const;
export const stashCapacity = (w: World) => STASH_CAPACITY[Math.min(STATION_MAX, Math.max(1, w.levels.stash ?? 1))];

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Price of a station level. Lv2 is money (the stash also wants logs). The
 * upper levels come from the cave: Lv3 needs gold and Lv4 diamonds, for a
 * lot less money than the old all-cash price.
 */
export function levelCost(station: StationId, level: number): { cost: Pad['cost']; parts: PadPart[] } {
  const base = LEVEL_BASE[station];
  if (station === 'stash') {
    if (level <= 2) return { cost: { kind: 'coin', amount: 120 }, parts: [{ kind: 'wood', amount: 20, paid: 0 }] };
    if (level === 3) return { cost: { kind: 'coin', amount: 300 }, parts: [{ kind: 'stone', amount: 20, paid: 0 }, { kind: 'gold', amount: 4, paid: 0 }] };
    return { cost: { kind: 'coin', amount: 600 }, parts: [{ kind: 'stone', amount: 30, paid: 0 }, { kind: 'diamond', amount: 3, paid: 0 }] };
  }
  if (level <= 2) return { cost: { kind: 'coin', amount: base }, parts: [] };
  if (level === 3) return { cost: { kind: 'coin', amount: round10(base * LEVEL_COST_GROWTH * 0.6) }, parts: [{ kind: 'gold', amount: 3, paid: 0 }] };
  return { cost: { kind: 'coin', amount: round10(base * LEVEL_COST_GROWTH * LEVEL_COST_GROWTH * 0.6) }, parts: [{ kind: 'diamond', amount: 2, paid: 0 }] };
}

/** Does this pad's price include something only the cave gives? */
export const needsGems = (pad: Pad) => (pad.parts ?? []).some((p) => p.kind === 'gold' || p.kind === 'diamond');

export const STATION_LABEL: Record<StationId, string> = {
  grill: 'Grill',
  hatch: 'Serving hatch',
  fishing: 'Fishing',
  lumber: 'Lumber camp',
  smoke: 'Smokehouse',
  stash: 'Stash',
};

const STATION_PERK: Record<StationId, string> = {
  grill: 'Cooks faster',
  hatch: 'Meals pay more',
  fishing: 'Fish bite faster',
  lumber: 'Lumberjacks chop faster',
  smoke: 'Smokes faster',
  stash: 'Holds more',
};

// --- Station effects -------------------------------------------------------

export const cookTime = (w: World) => COOK_TIME / (1 + 0.4 * (w.levels.grill - 1));
export const mealPrice = (w: World) => MEAL_PRICE + 4 * (w.levels.hatch - 1);
export const fishPace = (w: World) => 1 + 0.35 * (w.levels.fishing - 1);
export const playerFishInterval = (w: World) => FISH_INTERVAL / fishPace(w);
export const lumberPace = (w: World) => 1 + 0.35 * (w.levels.lumber - 1);
export const smokeTime = (w: World) => SMOKE_TIME / (1 + 0.45 * (w.levels.smoke - 1));

export function completeLevelPad(w: World, pad: Pad, station: StationId): void {
  w.levels[station]++;
  const lv = w.levels[station];
  celebrate(w, pad.pos, `${STATION_LABEL[station]} Lv ${lv}!`);
  // The station itself shows the new level: its new piece pops in with dust and sparkles.
  const st = w.structures[STATION_STRUCTURE[station]];
  if (st) {
    st.bumpAt = w.time;
    markLevelUp(w, station);
    burst(w, 'puff', st.pos, 8, { color: ['#ffffff', '#e9e1d4'], z: 8, speed: 1.4, up: 26, size: 7, life: 0.6 });
    burst(w, 'spark', st.pos, 10, { color: ['#ffe58a', '#ffffff'], z: 30, speed: 1.5, up: 120, size: 2, life: 0.7 });
    ring(w, st.pos, 1.1, '#ffe58a', 0.45);
  }
  sfx(w, 'upgrade');
  popup(w, pad.pos, 80, STATION_PERK[station], '#ffe8a3');
  addXp(w, 15, pad.pos);
  if (lv >= STATION_MAX) {
    pad.active = false;
    pad.completed = true;
    return;
  }
  // Re-open at the next price once the player steps off.
  pad.completed = false;
  pad.active = false;
  pad.rearm = true;
  pad.paid = 0;
  pad.level = lv + 1;
  const next = levelCost(station, lv + 1);
  pad.cost = next.cost;
  pad.parts = next.parts;
}

/** Re-open level pads after the player has stepped off them. */
export function updateLevelPads(w: World): void {
  const p = w.player.pos;
  for (const pad of Object.values(w.pads)) {
    // Gold/diamond levels wait, locked, until the cave is lit.
    if (pad.effect.type === 'level' && !pad.completed && needsGems(pad) && !w.flags.cave) {
      if (pad.active) {
        pad.active = false;
        pad.rearm = true;
      }
      if (pad.rearm) pad.locked = true;
      continue;
    }
    if (!pad.rearm) continue;
    const h = pad.size / 2 + 0.15;
    if (Math.abs(p.x - pad.pos.x) < h && Math.abs(p.y - pad.pos.y) < h) continue;
    pad.rearm = false;
    pad.active = true;
    pad.locked = false;
    pad.activatedAt = w.time;
  }
}

// --- Camp level ------------------------------------------------------------

export const campXpFor = (level: number) => 40 + 35 * (level - 1) + 6 * (level - 1) ** 2;
export const levelReward = (level: number) => 15 + level * 10;

export function addXp(w: World, amount: number, at?: Vec): void {
  const c = w.camp;
  c.xp += amount;
  if (at && amount >= 5) popup(w, at, 70, `+${amount} XP`, '#a8d8ff');
  while (c.xp >= c.next) {
    c.xp -= c.next;
    c.level++;
    c.next = campXpFor(c.level);
    const reward = levelReward(c.level);
    w.coins += reward;
    w.stats.coinsEarned += reward;
    const pos = w.player.pos;
    let sub = `+$${reward} reward`;
    if (c.level % 3 === 0 && c.level <= 12) {
      w.player.capacity += 4;
      sub += ' · Bigger pack (+4)';
    }
    burst(w, 'confetti', pos, 34, { color: ['#ffd34d', '#6fdc8c', '#4aa3ff', '#ff7a6b', '#ffffff'], z: 40, speed: 1.9, up: 200, size: 3.4, life: 1.6 });
    w.shake = Math.max(w.shake, 0.35);
    showToast(w, 'level', `Camp level ${c.level}!`, sub);
  }
}

let toastId = 0;
export function showToast(w: World, kind: 'mission' | 'level', title: string, sub: string): void {
  // A level-up outranks a mission toast that is still showing.
  if (kind === 'mission' && w.toast?.kind === 'level' && w.time - w.toast.at < 1.6) return;
  sfx(w, kind === 'level' ? 'levelup' : 'mission');
  w.toast = { id: ++toastId, kind, title, sub, at: w.time };
}
