import { FIRE_WOOD_REQUIRED, REGROW, SELL_PRICE } from '../core/constants';
import { playerFishInterval } from './levels';
import { dist } from '../core/math';
import type { Carryable, Pad, ResourceNode, Vec, World } from '../core/types';
import { SPOTS } from '../world/layout';
import { completePad } from './build';
import { addFlyer, burst, cashTopZ, popup, ring, sfx, stackTopZ } from './effects';

const playerTarget = (w: World) => () => w.player.pos;
const GRILL_TRAY = (w: World): Vec => ({ x: w.structures.grill.pos.x + 0.55, y: w.structures.grill.pos.y + 0.35 });

/** Coins enter the wallet (and the cash stack on the player's back). */
export function earn(w: World, amount: number, at?: Vec): void {
  w.coins += amount;
  w.stats.coinsEarned += amount;
  w.player.bumpAt = w.time;
  if (at) popup(w, at, 46, `+$${amount}`, '#9cf5a8');
}

/**
 * Arcade-style ground interactions: everything happens by standing on or
 * next to something. Only one interaction runs per frame, in priority order.
 */
export function updatePlayerInteractions(w: World, dt: number): void {
  const p = w.player;
  p.transferT -= dt;
  p.actionT -= dt;
  p.lookAt = null;
  if (p.knockedT > 0) return;
  const S = w.structures;
  const full = p.carry.length >= p.capacity;

  for (const pad of Object.values(w.pads)) {
    if (!pad.active) continue;
    const h = pad.size / 2;
    if (Math.abs(p.pos.x - pad.pos.x) < h && Math.abs(p.pos.y - pad.pos.y) < h) {
      payPad(w, pad);
      return;
    }
  }

  // Phase 1: feed the campfire.
  if (w.flags.fireAcceptsWood && !w.fire.lit && dist(p.pos, S.campfire.pos) < 1.6 && p.carry.includes('wood')) {
    p.lookAt = S.campfire.pos;
    if (p.transferT <= 0) {
      p.carry.splice(p.carry.lastIndexOf('wood'), 1);
      p.transferT = 0.09;
      addFlyer(w, 'wood', p.pos, stackTopZ(p.carry.length), S.campfire.pos, 8, 0.3, 30, () => {
        w.fire.fuel++;
        S.campfire.bumpAt = w.time;
        burst(w, 'spark', S.campfire.pos, 3, { color: '#ffb02e', z: 8, speed: 0.8, up: 90, size: 1.8, life: 0.5 });
        if (w.fire.fuel >= FIRE_WOOD_REQUIRED && !w.fire.lit) igniteFire(w);
      });
    }
    return;
  }

  // Cash pad: bills jump onto your back.
  if (S.cashPad.built && dist(p.pos, S.cashPad.pos) < 0.75 && w.kitchen.cash > 0) {
    if (p.transferT <= 0) {
      const chunk = Math.min(w.kitchen.cash, Math.max(5, Math.ceil(w.kitchen.cash / 8)));
      w.kitchen.cash -= chunk;
      w.stats.cashCollected += chunk;
      S.cashPad.bumpAt = w.time;
      addFlyer(w, 'coin', S.cashPad.pos, 8, playerTarget(w), cashTopZ(w.coins), 0.26, 22, () => earn(w, chunk));
      popup(w, p.pos, 60, `+$${chunk}`, '#9cf5a8');
      p.transferT = 0.06;
    }
    return;
  }

  // Serving counter: put meals out for the queue.
  if (S.counter.built && dist(p.pos, SPOTS.counterServe) < 0.85 && p.carry.includes('meal')) {
    p.lookAt = S.counter.pos;
    if (p.transferT <= 0) {
      p.carry.splice(p.carry.lastIndexOf('meal'), 1);
      p.transferT = 0.08;
      addFlyer(w, 'meal', p.pos, stackTopZ(p.carry.length), S.counter.pos, 18, 0.24, 16, () => {
        w.kitchen.counter++;
        S.counter.bumpAt = w.time;
      });
    }
    return;
  }

  // Grill: drop raw fish, pick up cooked meals.
  if (S.grill.built && dist(p.pos, S.grill.pos) < 1.15) {
    const hasRaw = p.carry.includes('fish');
    // Once a cook runs the kitchen, only lend a hand when the hatch runs dry.
    const cooking = w.workers.some((x) => x.role === 'cook');
    const wantMeals = w.kitchen.tray > 0 && !full && (!cooking || w.kitchen.counter < 2);
    if (hasRaw || wantMeals) {
      p.lookAt = S.grill.pos;
      if (p.transferT > 0) return;
      p.transferT = 0.08;
      if (hasRaw) {
        p.carry.splice(p.carry.lastIndexOf('fish'), 1);
        addFlyer(w, 'fish', p.pos, stackTopZ(p.carry.length), S.grill.pos, 18, 0.26, 18, () => {
          w.kitchen.raw++;
          S.grill.bumpAt = w.time;
        });
      } else {
        w.kitchen.tray--;
        p.carry.push('meal');
        addFlyer(w, 'meal', GRILL_TRAY(w), 16, playerTarget(w), stackTopZ(p.carry.length), 0.26, 18);
      }
      return;
    }
  }

  if (S.woodpile.built && dist(p.pos, S.woodpile.pos) < 0.95 && w.stock.wood > 0 && !full) {
    if (p.transferT <= 0) {
      w.stock.wood--;
      p.carry.push('wood');
      p.transferT = 0.08;
      S.woodpile.bumpAt = w.time;
      addFlyer(w, 'wood', S.woodpile.pos, 14, playerTarget(w), stackTopZ(p.carry.length), 0.28, 22);
    }
    return;
  }

  // Trade mat: sell raw goods, pick up the hauler's earnings.
  if (S.tradeMat.built && dist(p.pos, S.tradeMat.pos) < 1.0) {
    if (p.transferT > 0) return;
    const sellIdx = p.carry.findIndex((c) => c === 'wood' || c === 'stone' || c === 'ore');
    if (sellIdx >= 0) {
      const item = p.carry.splice(sellIdx, 1)[0];
      if (item === 'ore') w.stats.oreSold++;
      addFlyer(w, item, p.pos, stackTopZ(p.carry.length), S.tradeMat.pos, 6, 0.26, 20, () => {
        S.tradeMat.bumpAt = w.time;
        earn(w, SELL_PRICE[item], S.tradeMat.pos);
      });
      p.transferT = 0.07;
    } else if (w.coinPile > 0) {
      const chunk = Math.max(1, Math.ceil(w.coinPile / 10));
      w.coinPile -= chunk;
      addFlyer(w, 'coin', S.tradeMat.pos, 10, playerTarget(w), cashTopZ(w.coins), 0.26, 22, () => earn(w, chunk));
      p.transferT = 0.05;
    }
    return;
  }

  // Visiting caravan pays double for anything you carry.
  const cv = w.caravan;
  if (cv && cv.state === 'trading' && dist(p.pos, cv.pos) < 1.4 && p.carry.length) {
    p.lookAt = cv.pos;
    if (p.transferT <= 0) {
      const item = p.carry.pop() as Carryable;
      if (item === 'ore') w.stats.oreSold++;
      addFlyer(w, item, p.pos, stackTopZ(p.carry.length), cv.pos, 20, 0.26, 20, () => earn(w, SELL_PRICE[item] * 2, cv.pos));
      p.transferT = 0.07;
    }
    return;
  }

  // Ice fishing.
  if (w.flags.fishing && dist(p.pos, SPOTS.fishSpot) < 0.75 && !full) {
    p.lookAt = S.fishPond.pos;
    p.tool = 'rod';
    if (p.actionT <= 0) {
      p.actionT = playerFishInterval(w);
      p.swing = 1;
      p.carry.push('fish');
      w.stats.fishCaught++;
      const hole = S.fishPond.pos;
      ring(w, hole, 0.5, '#bfe3ff', 0.35);
      burst(w, 'puff', hole, 4, { color: '#e8f6ff', z: 4, speed: 0.6, up: 60, size: 4, life: 0.4 });
      addFlyer(w, 'fish', hole, 4, playerTarget(w), stackTopZ(p.carry.length), 0.38, 40);
      sfx(w, 'catch');
    }
    return;
  }

  if (!full) harvest(w);
}

function igniteFire(w: World): void {
  w.fire.lit = true;
  w.fire.litAt = w.time;
  w.shake = 0.45;
  w.hitstop = 0.08;
  const c = w.structures.campfire.pos;
  ring(w, c, 3, '#ffcf7a', 0.7);
  burst(w, 'spark', c, 30, { color: ['#ffb02e', '#ffd34d', '#ff7a1f'], z: 14, speed: 1.8, up: 160, size: 2.4, life: 1 });
  burst(w, 'puff', c, 10, { color: '#fff3d6', z: 10, speed: 1.4, up: 20, size: 10, life: 0.8 });
  popup(w, c, 70, 'The fire is lit!', '#ffcf7a', true);
  sfx(w, 'fire');
}

function payPad(w: World, pad: Pad): void {
  const p = w.player;
  if (p.transferT > 0) return;
  const remaining = pad.cost.amount - pad.paid;
  if (pad.cost.kind === 'coin') {
    if (w.coins <= 0) return;
    const chunk = Math.min(remaining, w.coins, Math.max(1, Math.ceil(pad.cost.amount / 25)));
    w.coins -= chunk;
    pad.paid += chunk;
    addFlyer(w, 'coin', p.pos, cashTopZ(w.coins + chunk), pad.pos, 2, 0.28, 26, () => {
      burst(w, 'spark', pad.pos, 2, { color: '#9cf5a8', z: 4, speed: 0.6, up: 50, size: 1.6, life: 0.4 });
    });
    p.transferT = 0.045;
  } else {
    const idx = p.carry.lastIndexOf(pad.cost.kind as Carryable);
    if (idx < 0) return;
    p.carry.splice(idx, 1);
    pad.paid++;
    addFlyer(w, pad.cost.kind, p.pos, stackTopZ(p.carry.length), pad.pos, 2, 0.28, 22);
    p.transferT = 0.07;
  }
  if (pad.paid >= pad.cost.amount) completePad(w, pad);
}

function canHarvest(w: World, n: ResourceNode): boolean {
  if (!n.visible || !n.interactive || n.amount <= 0 || n.popT > 0) return false;
  if (n.kind === 'tree') return w.flags.harvestWood;
  if (n.kind === 'rock') return w.flags.harvestStone;
  return w.flags.harvestOre;
}

function nearestNode(w: World, from: Vec, range: number): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestD = range;
  for (const n of w.nodes) {
    if (Math.abs(n.pos.x - from.x) > range || Math.abs(n.pos.y - from.y) > range) continue;
    if (!canHarvest(w, n)) continue;
    const d = dist(from, n.pos) - (n.kind !== 'tree' ? 0.2 : 0);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function harvest(w: World): void {
  const p = w.player;
  const node = nearestNode(w, p.pos, 1.05);
  if (!node) return;
  p.lookAt = node.pos;
  if (p.actionT > 0) return;
  hitNode(w, node);
  p.actionT = w.upgrades.sharpAxes ? 0.28 : 0.42;
  p.swing = 1;
  p.tool = node.kind === 'tree' ? 'axe' : 'pick';
  const item: Carryable = node.kind === 'tree' ? 'wood' : node.kind === 'rock' ? 'stone' : 'ore';
  p.carry.push(item);
  if (item === 'stone') w.stats.stoneGathered++;
  addFlyer(w, item, node.pos, 30, playerTarget(w), stackTopZ(p.carry.length), 0.32, 24);
  sfx(w, node.kind === 'tree' ? 'chop' : 'mine');
  popup(w, node.pos, 54, '+1', item === 'ore' ? '#ffcf7a' : '#ffffff');
}

/** Take one unit from a node (shared by player and workers). */
export function hitNode(w: World, node: ResourceNode): void {
  node.amount--;
  node.shake = 1;
  const tree = node.kind === 'tree';
  burst(w, 'chip', node.pos, 5, {
    color: tree ? ['#c9874e', '#e2a96f'] : node.kind === 'ore' ? ['#ffb347', '#6b7787'] : ['#9aa6b4', '#c6ced8'],
    z: 18,
    speed: 1.3,
    up: 120,
    size: 2.6,
    life: 0.7,
  });
  if (tree) burst(w, 'puff', node.pos, 4, { color: '#ffffff', z: 46, speed: 0.7, up: -12, size: 6, life: 0.7 });
  else burst(w, 'spark', node.pos, 3, { color: '#fff2b0', z: 14, speed: 1, up: 60, size: 1.5, life: 0.3 });
  if (node.amount <= 0) {
    node.amount = 0;
    node.regrowT = REGROW[node.kind];
    node.claimedBy = null;
    burst(w, 'puff', node.pos, 9, { color: '#ffffff', z: 10, speed: 1.3, up: 22, size: 8, life: 0.7 });
    ring(w, node.pos, 1, '#ffffff', 0.4);
  }
}
