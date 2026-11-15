import { NODE_AMOUNT, SELL_PRICE } from '../core/constants';
import { dist } from '../core/math';
import type { Vec, World } from '../core/types';
import { ICE_HOLES, inLake, LAKE, QUADRANTS, SPOTS } from '../world/layout';
import { addFlyer, burst, cashTopZ, popup, ring, sfx, stackTopZ } from './effects';
import { smokeTime } from './levels';

/**
 * Chapter 2 — The Frozen Lake.
 * Salmon is caught through holes in the lake ice, smoked in the Smokehouse,
 * and sold at the Fish Market for far more than anything else in camp.
 */

const playerTarget = (w: World) => () => w.player.pos;
const inWestYard = (x: number, y: number, m = 0) => {
  const r = QUADRANTS.west.rect;
  return x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
};

/** Chapter 2 opens: the forest west of the walls is cleared, ready for the new yard. */
export function clearWestYard(w: World): void {
  const pad = SPOTS.expandWest;
  for (let i = w.nodes.length - 1; i >= 0; i--) {
    const n = w.nodes[i];
    if (n.kind !== 'tree') continue;
    if (!inWestYard(n.pos.x, n.pos.y, 0.4) && dist(n.pos, pad) > 1.8) continue;
    if (n.amount > 0 && dist(n.pos, w.player.pos) < 14) {
      burst(w, 'puff', n.pos, 4, { color: '#ffffff', z: 20, speed: 1, up: 30, size: 8, life: 0.8 });
    }
    w.nodes.splice(i, 1);
  }
}

/** The west yard is walled in: the trees by the shore fall and the frozen lake appears. */
export function revealLake(w: World): void {
  if (w.flags.lake) return;
  w.flags.lake = true;
  for (let i = w.nodes.length - 1; i >= 0; i--) {
    const n = w.nodes[i];
    if (n.kind === 'icehole') continue;
    // Trees, rocks and ore that happened to sit on the lake or by the new gate.
    if (inLake(n.pos.x, n.pos.y, 0.7) || (n.kind === 'tree' && dist(n.pos, QUADRANTS.west.gates[0].outPoint) < 1.6)) w.nodes.splice(i, 1);
  }
  let id = w.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  for (const [i, h] of ICE_HOLES.entries()) {
    w.nodes.push({
      id: id++,
      kind: 'icehole',
      pos: { ...h },
      amount: NODE_AMOUNT.icehole,
      max: NODE_AMOUNT.icehole,
      regrowT: 0,
      shake: 0,
      claimedBy: null,
      visible: true,
      interactive: true,
      variant: i,
      popT: 0.5 + i * 0.12,
      elder: false,
    });
  }
  const c = { x: LAKE.x, y: LAKE.y };
  ring(w, c, 5, '#cfeaff', 0.9);
  burst(w, 'puff', c, 26, { color: '#eaf6ff', z: 8, speed: 2.2, up: 30, size: 12, life: 1.2 });
  popup(w, c, 80, 'A frozen lake!', '#bfe6ff', true);
}

/** Smoking racks: raw salmon in, smoked fish crates out. */
export function updateSmokehouse(w: World, dt: number): void {
  const sh = w.structures.smokehouse;
  if (!sh.built) return;
  const s = w.smoke;
  const t = smokeTime(w);
  for (let i = 0; i < s.slots.length; i++) {
    if (s.slots[i] < 0) {
      if (s.raw > 0) {
        s.raw--;
        s.slots[i] = 0;
      }
      continue;
    }
    s.slots[i] += dt / t;
    if (s.slots[i] >= 1) {
      s.slots[i] = -1;
      s.ready++;
      w.stats.salmonSmoked++;
      sh.bumpAt = w.time;
      burst(w, 'puff', sh.pos, 5, { color: '#d9d2c8', z: 40, speed: 0.6, up: 50, size: 8, life: 1 });
      popup(w, sh.pos, 50, 'Smoked!', '#ffcf7a');
      sfx(w, 'cooked');
    }
  }
}

/**
 * Player interactions in the west yard. Returns true when one ran (only one
 * interaction runs per frame).
 */
export function lakeInteractions(w: World): boolean {
  const p = w.player;
  const S = w.structures;
  const full = p.carry.length >= p.capacity;

  // Smokehouse: drop salmon; pick up smoked fish when no porter is running it.
  if (S.smokehouse.built && dist(p.pos, SPOTS.smokeDrop) < 1.1) {
    const hasSalmon = p.carry.includes('salmon');
    const porter = w.workers.some((x) => x.role === 'porter');
    const wantSmoked = w.smoke.ready > 0 && !full && (!porter || w.smoke.ready > 8);
    if (hasSalmon || wantSmoked) {
      p.lookAt = S.smokehouse.pos;
      if (p.transferT > 0) return true;
      p.transferT = 0.08;
      if (hasSalmon) {
        p.carry.splice(p.carry.lastIndexOf('salmon'), 1);
        addFlyer(w, 'salmon', p.pos, stackTopZ(p.carry.length), S.smokehouse.pos, 24, 0.26, 18, () => {
          w.smoke.raw++;
          S.smokehouse.bumpAt = w.time;
        });
      } else {
        w.smoke.ready--;
        p.carry.push('smoked');
        addFlyer(w, 'smoked', SPOTS.smokeDrop, 10, playerTarget(w), stackTopZ(p.carry.length), 0.26, 18);
      }
      return true;
    }
  }

  // Fish market: sell smoked fish, or scoop up what the porter earned.
  if (S.marketMat.built && dist(p.pos, S.marketMat.pos) < 1.0) {
    if (p.transferT > 0) return true;
    const idx = p.carry.lastIndexOf('smoked');
    if (idx >= 0) {
      p.carry.splice(idx, 1);
      w.stats.smokedSold++;
      addFlyer(w, 'smoked', p.pos, stackTopZ(p.carry.length), S.marketMat.pos, 6, 0.26, 20, () => {
        S.marketMat.bumpAt = w.time;
        w.coins += SELL_PRICE.smoked;
        w.stats.coinsEarned += SELL_PRICE.smoked;
        w.player.bumpAt = w.time;
        popup(w, S.marketMat.pos, 46, `+$${SELL_PRICE.smoked}`, '#9cf5a8');
      });
      p.transferT = 0.08;
      return true;
    }
    if (w.marketCash > 0) {
      const chunk = Math.max(1, Math.ceil(w.marketCash / 10));
      w.marketCash -= chunk;
      addFlyer(w, 'coin', S.marketMat.pos, 10, playerTarget(w), cashTopZ(w.coins), 0.26, 22, () => {
        w.coins += chunk;
        w.stats.coinsEarned += chunk;
      });
      p.transferT = 0.05;
      return true;
    }
  }
  return false;
}

/** Splash when a salmon comes up through the ice. */
export function iceSplash(w: World, at: Vec): void {
  ring(w, at, 0.55, '#bfe3ff', 0.35);
  burst(w, 'puff', at, 4, { color: '#e8f6ff', z: 4, speed: 0.6, up: 60, size: 4, life: 0.4 });
  burst(w, 'spark', at, 3, { color: '#cfeaff', z: 6, speed: 0.9, up: 80, size: 1.6, life: 0.4 });
}
