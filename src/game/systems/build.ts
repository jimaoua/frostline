import { lightCave } from './cave';
import { DOOR_HP, HAULER_SPEED, WORKER_SPEED } from '../core/constants';
import type { Pad, PadId, StructureId, UpgradeId, Vec, Worker, WorkerRole, World } from '../core/types';
import { SPOTS } from '../world/layout';
import { burst, celebrate, popup, ring } from './effects';
import { revealLake } from './lake';
import { addXp, completeLevelPad } from './levels';
import { makeMover } from './motion';

/** The stash sits in the east yard: it opens with the yard (and its upgrade pad). */
export function openStash(w: World): void {
  const st = w.structures.stash;
  if (!st.built) {
    st.built = true;
    st.builtAt = w.time;
  }
  const up = w.pads.upStash;
  if (!up.completed && !up.active && !up.rearm && w.levels.stash < 2) {
    up.active = true;
    up.activatedAt = w.time;
  }
}

export function activatePad(w: World, id: PadId): void {
  const p = w.pads[id];
  if (p.completed || p.active) return;
  p.active = true;
  p.activatedAt = w.time;
}

const UPGRADE_LABEL: Record<UpgradeId, string> = {
  bonfire: 'Bonfire roaring!',
  sharpAxes: 'Sharp Axes!',
  bigPacks: 'Big Packs!',
  ironArrows: 'Iron Arrows!',
  traps: 'Traps set!',
  gatehouse: 'Gates reinforced!',
};

export function completePad(w: World, pad: Pad): void {
  pad.active = false;
  pad.completed = true;
  const e = pad.effect;
  if (e.type !== 'level') addXp(w, 10, pad.pos);
  switch (e.type) {
    case 'level':
      completeLevelPad(w, pad, e.station);
      break;
    case 'build':
      for (const id of e.structures) buildStructure(w, id);
      celebrate(w, pad.pos, `${pad.label}!`);
      break;
    case 'expand': {
      const removed = w.base.unlock(e.quadrant);
      for (const p of removed) {
        burst(w, 'puff', p, 2, { color: '#f4f8fc', z: 12, speed: 0.8, up: 30, size: 7, life: 0.8 });
        burst(w, 'chip', p, 2, { color: '#b8743f', z: 18, speed: 1, up: 90, size: 2.5, life: 0.9 });
      }
      syncGateDefenses(w);
      celebrate(w, pad.pos, `${pad.label} unlocked!`);
      if (e.quadrant === 'west') revealLake(w);
      if (e.quadrant === 'east') openStash(w);
      break;
    }
    case 'upgrade':
      applyUpgrade(w, e.upgrade);
      celebrate(w, pad.pos, UPGRADE_LABEL[e.upgrade]);
      break;
    case 'hireRole':
      spawnWorker(w, e.role, { x: pad.pos.x, y: pad.pos.y });
      celebrate(w, pad.pos, e.role === 'porter' ? 'Porter hired!' : 'New worker!');
      break;
    case 'hire':
      // New survivors work the piles; nobody but the hero sells.
      spawnWorker(w, w.structures.quarryCamp.built && w.rng() < 0.5 ? 'miner' : 'lumberjack', { x: pad.pos.x, y: pad.pos.y });
      celebrate(w, pad.pos, 'New survivor!');
      w.morale = Math.min(100, w.morale + 6);
      break;
  }
}

export function applyUpgrade(w: World, u: UpgradeId): void {
  w.upgrades[u] = true;
  if (u === 'bigPacks') w.player.capacity += 12;
  if (u === 'bonfire') {
    w.structures.campfire.bumpAt = w.time;
    w.morale = Math.min(100, w.morale + 10);
  }
  if (u === 'traps' || u === 'gatehouse') syncGateDefenses(w);
}

/** Traps and doors follow the gates: new gates from expansions get them too. */
export function syncGateDefenses(w: World): void {
  for (const g of w.base.gates) {
    if (w.upgrades.traps && !w.traps.some((t) => Math.hypot(t.pos.x - g.outPoint.x, t.pos.y - g.outPoint.y) < 1.2)) {
      const dx = g.outPoint.x - g.inPoint.x;
      const dy = g.outPoint.y - g.inPoint.y;
      const len = Math.hypot(dx, dy) || 1;
      w.traps.push({ pos: { x: g.outPoint.x + (dx / len) * 0.6, y: g.outPoint.y + (dy / len) * 0.6 }, armed: true, rearmT: 0, snapAt: -10 });
    }
    if (w.upgrades.gatehouse && !w.doors[g.id]) w.doors[g.id] = { hp: DOOR_HP, max: DOOR_HP, open: 1, hitAt: -10 };
  }
}

export function buildStructure(w: World, id: StructureId): void {
  const s = w.structures[id];
  if (s.built) return;
  s.built = true;
  s.builtAt = w.time;
  ring(w, s.pos, 1.8, '#ffffff', 0.5);
  const at = (dx: number, dy: number): Vec => ({ x: s.pos.x + dx, y: s.pos.y + dy });
  switch (id) {
    case 'lumberHut':
      spawnWorker(w, 'lumberjack', at(1.1, 0.3));
      break;
    case 'fishShack':
      spawnWorker(w, 'fisher', at(0.2, 0.9));
      spawnWorker(w, 'cook', at(0.9, 0.3));
      break;
    case 'tradingPost':
      // No hauler: only the hero carries goods to the trade mat.
      break;
    case 'quarryCamp':
      spawnWorker(w, 'miner', at(-1.0, 0.2));
      break;
    case 'mineLodge':
      lightCave(w);
      break;
    case 'lakeCamp':
      spawnWorker(w, 'icefisher', at(-0.6, 0.9));
      spawnWorker(w, 'icefisher', at(0.6, 1.0));
      break;
    case 'tower1':
    case 'tower2':
    case 'tower3':
      w.towers.push({ id, pos: { ...s.pos }, cooldown: 0.5, aim: 0 });
      break;
    case 'shelter':
      w.morale = Math.min(100, w.morale + 15);
      popup(w, s.pos, 90, '+15 morale', '#ffd34d');
      break;
    default:
      break;
  }
}

export function spawnWorker(w: World, role: WorkerRole, at: Vec): Worker {
  const speed = role === 'hauler' || role === 'cook' || role === 'porter' ? HAULER_SPEED : WORKER_SPEED;
  const wk: Worker = {
    ...makeMover(at, speed),
    id: w.nextId++,
    role,
    state: 'idle',
    route: [],
    nodeId: null,
    carry: [],
    capacity: role === 'hauler' || role === 'porter' ? 6 : role === 'cook' ? 5 : role === 'fisher' || role === 'icefisher' ? 4 : 3,
    workT: 0,
    swing: 0,
    idleT: 0.6 + w.rng() * 0.6,
    home:
      role === 'fisher' || role === 'cook'
        ? { ...SPOTS.fishShack }
        : role === 'icefisher'
          ? { ...SPOTS.lakeCamp }
          : role === 'porter'
            ? { ...SPOTS.market }
            : { ...at },
    job: null,
  };
  w.workers.push(wk);
  burst(w, 'puff', at, 6, { color: '#ffffff', z: 6, speed: 0.8, up: 20, size: 6, life: 0.5 });
  return wk;
}
