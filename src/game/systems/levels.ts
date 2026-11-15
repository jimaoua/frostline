import { COOK_TIME, FISH_INTERVAL, MEAL_PRICE } from '../core/constants';
import type { Pad, StationId, Vec, World } from '../core/types';
import { burst, celebrate, popup, sfx } from './effects';

/**
 * Two small loops that keep players coming back for "one more":
 *  - Station levels: every station has its own upgrade pad that re-opens at a
 *    higher price after each purchase, so there is always something to buy.
 *  - Camp level: XP from missions, meals, builds and wolves; every level-up
 *    pays a cash reward (and a bigger pack every third level, up to level 12).
 */

export const STATION_MAX = 4;

/** Cost multiplier for each further station level. */
const LEVEL_COST_GROWTH = 2.1;

export const STATION_LABEL: Record<StationId, string> = {
  grill: 'Grill',
  hatch: 'Serving hatch',
  fishing: 'Fishing',
  lumber: 'Lumber camp',
};

const STATION_PERK: Record<StationId, string> = {
  grill: 'Cooks faster',
  hatch: 'Meals pay more',
  fishing: 'Fish bite faster',
  lumber: 'Lumberjacks chop faster',
};

// --- Station effects -------------------------------------------------------

export const cookTime = (w: World) => COOK_TIME / (1 + 0.4 * (w.levels.grill - 1));
export const mealPrice = (w: World) => MEAL_PRICE + 4 * (w.levels.hatch - 1);
export const fishPace = (w: World) => 1 + 0.35 * (w.levels.fishing - 1);
export const playerFishInterval = (w: World) => FISH_INTERVAL / fishPace(w);
export const lumberPace = (w: World) => 1 + 0.35 * (w.levels.lumber - 1);

export function completeLevelPad(w: World, pad: Pad, station: StationId): void {
  w.levels[station]++;
  const lv = w.levels[station];
  celebrate(w, pad.pos, `${STATION_LABEL[station]} Lv ${lv}!`);
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
  pad.cost = { ...pad.cost, amount: Math.round((pad.cost.amount * LEVEL_COST_GROWTH) / 10) * 10 };
}

/** Re-open level pads after the player has stepped off them. */
export function updateLevelPads(w: World): void {
  const p = w.player.pos;
  for (const pad of Object.values(w.pads)) {
    if (!pad.rearm) continue;
    const h = pad.size / 2 + 0.15;
    if (Math.abs(p.x - pad.pos.x) < h && Math.abs(p.y - pad.pos.y) < h) continue;
    pad.rearm = false;
    pad.active = true;
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
      w.player.capacity += 2;
      sub += ' · Bigger pack (+2)';
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
