import { surplus } from './padcost';
import { FIRE_WARM_RADIUS, SELL_PRICE } from '../core/constants';
import { dist } from '../core/math';
import type { Carryable, NodeKind, ResourceNode, Vec, Worker, World } from '../core/types';
import { MEADOWS, SPOTS } from '../world/layout';
import { addFlyer, ring, stackTopZ } from './effects';
import { hitNode } from './interact';
import { iceSplash } from './lake';
import { brake, followRoute, updateMotion } from './motion';
import { fishPace, lumberPace } from './levels';
import { planRoute } from './routing';


/** Morale scales how briskly the camp works (0.75x … 1.2x). */
export const moraleFactor = (w: World) => 0.75 + (w.morale / 100) * 0.45;

const dropFor = (w: World, wk: Worker) =>
  wk.role === 'miner' ? w.structures.stonepile : wk.role === 'icefisher' ? w.structures.smokehouse : w.structures.woodpile;
const nodeKindFor = (wk: Worker): NodeKind => (wk.role === 'miner' ? 'rock' : wk.role === 'icefisher' ? 'icehole' : 'tree');
/** Where workers stand to hand over at a building (the smokehouse has a drop spot). */
const dropSpot = (w: World, wk: Worker): Vec => (wk.role === 'icefisher' ? SPOTS.smokeDrop : dropFor(w, wk).pos);

function goTo(w: World, wk: Worker, to: Vec): void {
  wk.route = planRoute(w.base, wk.pos, to);
}

function findNode(w: World, wk: Worker): ResourceNode | null {
  const anchor = dropFor(w, wk).pos;
  const kind = nodeKindFor(wk);
  let best: ResourceNode | null = null;
  let bestD = wk.role === 'icefisher' ? 30 : 15;
  for (const n of w.nodes) {
    if (n.kind !== kind || n.elder || !n.visible || !n.interactive || n.amount <= 0 || n.popT > 0 || n.claimedBy !== null) continue;
    const d = dist(anchor, n.pos) + (dist(w.player.pos, n.pos) < 2 ? 4 : 0);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function approach(node: ResourceNode, from: Vec): Vec {
  const dx = from.x - node.pos.x;
  const dy = from.y - node.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const r = node.kind === 'rock' ? 0.75 : node.kind === 'icehole' ? 0.7 : 0.6;
  return { x: node.pos.x + (dx / d) * r, y: node.pos.y + (dy / d) * r };
}

function release(w: World, wk: Worker): void {
  if (wk.nodeId === null) return;
  const n = w.nodes.find((x) => x.id === wk.nodeId);
  if (n && n.claimedBy === wk.id) n.claimedBy = null;
  wk.nodeId = null;
}

function wander(w: World, wk: Worker): void {
  const a = w.rng() * Math.PI * 2;
  const r = 0.4 + w.rng() * 0.8;
  goTo(w, wk, { x: wk.home.x + Math.cos(a) * r, y: wk.home.y + Math.sin(a) * r });
  wk.state = 'wander';
}

/** Blizzards send everyone to the fire. */
export function sendToHuddle(w: World, wk: Worker, i: number): void {
  release(w, wk);
  const a = (i / 7) * Math.PI * 2 + 0.3;
  const c = w.structures.campfire.pos;
  goTo(w, wk, { x: c.x + Math.cos(a) * 1.3, y: c.y + Math.sin(a) * 1.3 });
  wk.state = 'huddle';
}

function chooseTask(w: World, wk: Worker, dt: number): void {
  if (wk.idleT > 0) {
    wk.idleT -= dt;
    brake(wk, dt);
    return;
  }
  const k = w.kitchen;
  switch (wk.role) {
    case 'hauler': {
      // Materials an open building still needs stay on the piles for the player.
      const wood = surplus(w, 'wood');
      const stone = surplus(w, 'stone');
      if (wood + stone > 0) {
        const from = stone >= wood ? w.structures.stonepile : w.structures.woodpile;
        if (from.built) {
          goTo(w, wk, from.pos);
          wk.state = 'toPickup';
          return;
        }
      }
      wk.idleT = 1.2;
      wander(w, wk);
      return;
    }
    case 'fisher':
      goTo(w, wk, SPOTS.fisherSpot);
      wk.state = 'toNode';
      return;
    case 'porter':
      if (w.smoke.ready > 0 && w.structures.marketMat.built) {
        goTo(w, wk, SPOTS.smokeDrop);
        wk.state = 'toPickup';
        return;
      }
      wk.idleT = 1;
      wander(w, wk);
      return;
    case 'cook':
      if (k.tray > 0 && k.counter < 14) {
        goTo(w, wk, { x: w.structures.grill.pos.x + 0.7, y: w.structures.grill.pos.y + 0.55 });
        wk.job = 'toCounter';
        wk.state = 'toPickup';
        return;
      }
      wk.idleT = 0.8;
      wander(w, wk);
      return;
    default: {
      const node = findNode(w, wk);
      if (!node) {
        wk.idleT = 1.5;
        wander(w, wk);
        return;
      }
      node.claimedBy = wk.id;
      wk.nodeId = node.id;
      goTo(w, wk, approach(node, dropSpot(w, wk)));
      wk.state = 'toNode';
    }
  }
}

function updateWorker(w: World, wk: Worker, dt: number): void {
  wk.swing = Math.max(0, wk.swing - dt * 3.5);
  wk.lookAt = null;
  const pace = moraleFactor(w);
  const k = w.kitchen;
  switch (wk.state) {
    case 'idle':
      chooseTask(w, wk, dt);
      break;

    case 'wander':
      if (followRoute(wk, dt, 0.6)) wk.state = 'idle';
      break;

    case 'huddle':
      if (followRoute(wk, dt)) wk.lookAt = w.structures.campfire.pos;
      if (w.event?.kind !== 'blizzard') {
        wk.state = 'idle';
        wk.idleT = 0.3;
      }
      break;

    case 'toNode': {
      if (!followRoute(wk, dt, pace)) break;
      if (wk.role === 'fisher') {
        wk.state = 'working';
        wk.workT = 1;
        break;
      }
      const node = w.nodes.find((n) => n.id === wk.nodeId);
      if (!node || node.amount <= 0) {
        release(w, wk);
        wk.state = 'idle';
        break;
      }
      wk.state = 'working';
      wk.workT = 0.3;
      break;
    }

    case 'working': {
      brake(wk, dt);
      if (wk.role === 'fisher') {
        // Pine Valley: the hunter watches the meadow from a hide instead of a hole in the ice.
        const from = w.worldId === 2 ? MEADOWS[0] : w.structures.fishPond.pos;
        wk.lookAt = from;
        wk.workT -= dt * pace * fishPace(w);
        if (wk.workT > 0) break;
        wk.workT = 1.5;
        wk.swing = 1;
        wk.carry.push('fish');
        w.stats.fishCaught++;
        ring(w, from, 0.45, w.worldId === 2 ? '#e9d3b0' : '#bfe3ff', 0.3);
        addFlyer(w, 'fish', from, 4, () => wk.pos, stackTopZ(wk.carry.length), 0.36, 36);
        if (wk.carry.length >= wk.capacity) {
          goTo(w, wk, { x: w.structures.grill.pos.x - 0.75, y: w.structures.grill.pos.y + 0.4 });
          wk.state = 'toDrop';
        }
        break;
      }
      const node = w.nodes.find((n) => n.id === wk.nodeId);
      if (!node || node.amount <= 0) {
        release(w, wk);
        wk.state = wk.carry.length ? 'toDrop' : 'idle';
        if (wk.carry.length) goTo(w, wk, dropSpot(w, wk));
        break;
      }
      wk.lookAt = node.pos;
      if (wk.role === 'icefisher') {
        // Fishing through the ice: slower than chopping, a salmon per catch.
        wk.workT -= dt * pace * fishPace(w);
        if (wk.workT > 0) break;
        wk.workT = 1.6;
        wk.swing = 1;
        hitNode(w, node);
        wk.carry.push('salmon');
        w.stats.salmonCaught++;
        iceSplash(w, node.pos);
        addFlyer(w, 'salmon', node.pos, 4, () => wk.pos, stackTopZ(wk.carry.length), 0.36, 36);
        if (wk.carry.length >= wk.capacity || node.amount <= 0) {
          release(w, wk);
          if (wk.carry.length >= wk.capacity) {
            goTo(w, wk, dropSpot(w, wk));
            wk.state = 'toDrop';
          } else wk.state = 'idle';
        }
        break;
      }
      wk.workT -= dt * pace * (w.upgrades.sharpAxes ? 1.4 : 1) * (wk.role === 'lumberjack' ? lumberPace(w) : 1);
      if (wk.workT > 0) break;
      wk.workT = 0.75;
      wk.swing = 1;
      hitNode(w, node);
      const item: Carryable = node.kind === 'tree' ? 'wood' : 'stone';
      wk.carry.push(item);
      addFlyer(w, item, node.pos, 30, () => wk.pos, stackTopZ(wk.carry.length), 0.3, 18);
      if (wk.carry.length >= wk.capacity || node.amount <= 0) {
        release(w, wk);
        goTo(w, wk, dropFor(w, wk).pos);
        wk.state = 'toDrop';
      }
      break;
    }

    case 'toDrop': {
      if (!followRoute(wk, dt, pace)) break;
      if (wk.role === 'fisher') {
        const grill = w.structures.grill;
        wk.lookAt = grill.pos;
        wk.carry.forEach((_, i) =>
          addFlyer(w, 'fish', wk.pos, stackTopZ(i), grill.pos, 18, 0.25 + i * 0.06, 16, () => {
            k.raw++;
            grill.bumpAt = w.time;
          }),
        );
        wk.carry = [];
        wk.state = 'idle';
        wk.idleT = 0.2;
        break;
      }
      if (wk.role === 'icefisher') {
        const sh = w.structures.smokehouse;
        wk.lookAt = sh.pos;
        wk.carry.forEach((_, i) =>
          addFlyer(w, 'salmon', wk.pos, stackTopZ(i), sh.pos, 24, 0.25 + i * 0.06, 16, () => {
            w.smoke.raw++;
            sh.bumpAt = w.time;
          }),
        );
        wk.carry = [];
        wk.state = 'idle';
        wk.idleT = 0.3;
        break;
      }
      const pile = dropFor(w, wk);
      wk.carry.forEach((item, i) =>
        addFlyer(w, item, wk.pos, stackTopZ(i), pile.pos, 10, 0.25 + i * 0.05, 16, () => {
          pile.bumpAt = w.time;
        }),
      );
      for (const item of wk.carry) {
        w.stock[item]++;
        if (item === 'wood') w.stats.woodDelivered++;
        else w.stats.stoneGathered++;
      }
      wk.carry = [];
      wk.state = 'idle';
      wk.idleT = 0.3;
      break;
    }

    case 'toPickup': {
      if (!followRoute(wk, dt, pace)) break;
      if (wk.role === 'cook') {
        const n = Math.min(wk.capacity, k.tray);
        if (n <= 0) {
          wk.state = 'idle';
          break;
        }
        k.tray -= n;
        for (let i = 0; i < n; i++) {
          wk.carry.push('meal');
          addFlyer(w, 'meal', w.structures.grill.pos, 16, () => wk.pos, stackTopZ(i + 1), 0.22 + i * 0.05, 16);
        }
        goTo(w, wk, SPOTS.counterServe);
        wk.state = 'toSell';
        break;
      }
      if (wk.role === 'porter') {
        const n = Math.min(wk.capacity, w.smoke.ready);
        if (n <= 0) {
          wk.state = 'idle';
          break;
        }
        w.smoke.ready -= n;
        for (let i = 0; i < n; i++) {
          wk.carry.push('smoked');
          addFlyer(w, 'smoked', SPOTS.smokeDrop, 10, () => wk.pos, stackTopZ(i + 1), 0.22 + i * 0.05, 16);
        }
        goTo(w, wk, w.structures.marketMat.pos);
        wk.state = 'toSell';
        break;
      }
      const kind: 'wood' | 'stone' = dist(wk.pos, w.structures.stonepile.pos) < dist(wk.pos, w.structures.woodpile.pos) ? 'stone' : 'wood';
      const pile = kind === 'stone' ? w.structures.stonepile : w.structures.woodpile;
      const n = Math.min(wk.capacity, surplus(w, kind));
      if (n <= 0) {
        wk.state = 'idle';
        break;
      }
      w.stock[kind] -= n;
      pile.bumpAt = w.time;
      for (let i = 0; i < n; i++) {
        wk.carry.push(kind);
        addFlyer(w, kind, pile.pos, 12, () => wk.pos, stackTopZ(i + 1), 0.25 + i * 0.05, 18);
      }
      goTo(w, wk, w.structures.tradeMat.pos);
      wk.state = 'toSell';
      break;
    }

    case 'toSell': {
      if (!followRoute(wk, dt, pace)) break;
      if (wk.role === 'cook') {
        const counter = w.structures.counter;
        wk.lookAt = counter.pos;
        wk.carry.forEach((_, i) =>
          addFlyer(w, 'meal', wk.pos, stackTopZ(i), counter.pos, 18, 0.22 + i * 0.06, 14, () => {
            k.counter++;
            counter.bumpAt = w.time;
          }),
        );
        wk.carry = [];
        wk.state = 'idle';
        wk.idleT = 0.3;
        break;
      }
      if (wk.role === 'porter') {
        const mm = w.structures.marketMat;
        wk.carry.forEach((item, i) => {
          w.marketCash += SELL_PRICE[item];
          w.stats.smokedSold++;
          addFlyer(w, item, wk.pos, stackTopZ(i), mm.pos, 6, 0.25 + i * 0.05, 16, () => {
            mm.bumpAt = w.time;
          });
        });
        wk.carry = [];
        wk.state = 'idle';
        wk.idleT = 0.4;
        break;
      }
      const mat = w.structures.tradeMat;
      wk.carry.forEach((item, i) => {
        w.coinPile += SELL_PRICE[item];
        addFlyer(w, item, wk.pos, stackTopZ(i), mat.pos, 6, 0.25 + i * 0.05, 16, () => {
          mat.bumpAt = w.time;
        });
      });
      wk.carry = [];
      wk.state = 'idle';
      wk.idleT = 0.4;
      break;
    }
  }
}

export function updateWorkers(w: World, dt: number): void {
  const blizzard = w.event?.kind === 'blizzard';
  const c = w.structures.campfire.pos;
  w.workers.forEach((wk, i) => {
    if (blizzard && wk.state !== 'huddle' && dist(wk.pos, c) > FIRE_WARM_RADIUS - 0.4) sendToHuddle(w, wk, i);
    updateWorker(w, wk, dt);
    updateMotion(wk, dt, w, { mouthZ: 36 });
  });
}
