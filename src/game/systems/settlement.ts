import { FIRE_WARM_RADIUS, MAX_QUEUE } from '../core/constants';
import { addXp, cookTime, mealPrice } from './levels';
import { buildStructure, spawnWorker } from './build';
import { celebrate } from './effects';
import { clamp, dist } from '../core/math';
import type { Emote, Survivor, Vec, World } from '../core/types';
import { SPOTS, queueSlot } from '../world/layout';
import { addFlyer, burst, popup, sfx } from './effects';
import { brake, followRoute, makeMover, updateMotion } from './motion';
import { planRoute } from './routing';

const MAX_RESIDENTS = 8;
let serveT = 0;

export const residents = (w: World) => w.survivors.filter((s) => s.state === 'resident' || s.state === 'huddle' || s.state === 'panic').length;

function emote(s: Survivor, e: Emote, t = 1.6): void {
  s.emote = e;
  s.emoteT = t;
}

/* ---------------- Kitchen: raw fish → grill → tray, counter → cash ---------------- */

export function updateKitchen(w: World, dt: number): void {
  const k = w.kitchen;
  const grill = w.structures.grill;
  if (!grill.built) return;
  for (let i = 0; i < k.slots.length; i++) {
    if (k.slots[i] < 0) {
      if (k.raw > 0 && k.tray < 16) {
        k.raw--;
        k.slots[i] = 0;
      }
      continue;
    }
    k.slots[i] += dt / cookTime(w);
    if (w.rng() < dt * 5) {
      w.particles.push({
        kind: 'steam',
        x: grill.pos.x + (i - 1) * 0.28,
        y: grill.pos.y,
        z: 24,
        vx: 0,
        vy: 0,
        vz: 22,
        life: 0.9,
        maxLife: 0.9,
        size: 3,
        color: '#ffffff',
        spin: 0,
      });
    }
    if (k.slots[i] >= 1) {
      k.slots[i] = -1;
      k.tray++;
      w.stats.mealsCooked++;
      grill.bumpAt = w.time;
      burst(w, 'spark', grill.pos, 3, { color: '#ffcf7a', z: 22, speed: 0.6, up: 60, size: 1.6, life: 0.4 });
      popup(w, grill.pos, 44, 'Cooked!', '#ffcf7a');
      sfx(w, 'cooked');
    }
  }
}

/* ---------------- Survivors: arrive, queue, get served, settle or leave ---------------- */

function queue(w: World): Survivor[] {
  return w.survivors.filter((s) => s.state === 'arriving' || s.state === 'queue').sort((a, b) => a.slot - b.slot);
}

function reslot(w: World): void {
  queue(w).forEach((s, i) => {
    if (s.slot === i) return;
    s.slot = i;
    s.route = [queueSlot(i)];
    if (s.state === 'queue') s.state = 'arriving';
  });
}

/** Opening mini-quest: a survivor freezing outside the gate. */
export function spawnStranded(w: World): void {
  const s: Survivor = {
    ...makeMover(SPOTS.stranded, 2.9),
    id: w.nextId++,
    state: 'stranded',
    route: [],
    slot: -1,
    patience: 999,
    emote: 'cold',
    emoteT: 999,
    hop: 0,
    look: 3,
    carryMeal: false,
    idleT: 0,
  };
  s.facing = -Math.PI / 2;
  w.survivors.push(s);
}

export const warmRadius = (w: World) => FIRE_WARM_RADIUS + (w.upgrades.bonfire ? 1 : 0);

function spawnSurvivor(w: World): void {
  const slot = queue(w).length;
  const start = { x: SPOTS.roadEnd.x + (w.rng() - 0.5) * 0.6, y: SPOTS.roadEnd.y };
  const s: Survivor = {
    ...makeMover(start, 1.9 + w.rng() * 0.4),
    id: w.nextId++,
    state: 'arriving',
    route: [{ x: 26.6, y: 28.6 }, queueSlot(slot)],
    slot,
    patience: 50,
    emote: null,
    emoteT: 0,
    hop: 0,
    look: Math.floor(w.rng() * 5),
    carryMeal: false,
    idleT: 0,
  };
  w.survivors.push(s);
}

function residentSpot(w: World): Vec {
  const c = w.structures.campfire.pos;
  const a = w.rng() * Math.PI * 2;
  const r = 1.4 + w.rng() * 1.3;
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
}

export function updateSurvivors(w: World, dt: number): void {
  const blizzard = w.event?.kind === 'blizzard';
  const raid = w.wolves.some((x) => x.mode === 'raid') || w.wolves.some((x) => x.chasing && dist(x.pos, w.structures.campfire.pos) < 9);
  const counter = w.structures.counter;

  if (w.flags.survivors && counter.built && !blizzard) {
    w.survivorSpawnT -= dt;
    if (w.survivorSpawnT <= 0) {
      const boost = w.upgrades.bonfire ? 0.7 : 1;
      w.survivorSpawnT = (3.0 + w.rng() * 1.4) * boost;
      if (queue(w).length < MAX_QUEUE + (w.upgrades.bonfire ? 2 : 0)) spawnSurvivor(w);
    }
  }

  // Serve the person at the hatch.
  serveT -= dt;
  const front = queue(w)[0];
  if (front && front.state === 'queue' && front.slot === 0 && w.kitchen.counter > 0 && serveT <= 0) {
    serveT = 0.55;
    w.kitchen.counter--;
    counter.bumpAt = w.time;
    front.carryMeal = true;
    front.hop = 1;
    emote(front, 'heart');
    front.state = 'served';
    front.idleT = 0.7;
    w.stats.mealsServed++;
    addXp(w, 2);
    const price = mealPrice(w);
    w.morale = Math.min(100, w.morale + 0.6);
    for (let i = 0; i < 2; i++) {
      addFlyer(w, 'coin', front.pos, 30, w.structures.cashPad.pos, 4, 0.42 + i * 0.08, 36, () => {
        w.kitchen.cash += price / 2;
        w.structures.cashPad.bumpAt = w.time;
        burst(w, 'spark', w.structures.cashPad.pos, 2, { color: '#9cf5a8', z: 6, speed: 0.6, up: 50, size: 1.6, life: 0.35 });
      });
    }
    popup(w, front.pos, 56, `$${price}`, '#9cf5a8');
    reslot(w);
  }

  const cold = w.day.active && nightAmount(w) > 0.5;
  for (const s of w.survivors) {
    s.emoteT -= dt;
    if (s.emoteT <= 0) s.emote = null;
    s.hop = Math.max(0, s.hop - dt * 2.5);
    s.lookAt = null;
    switch (s.state) {
      case 'stranded':
        brake(s, dt);
        s.emote = 'cold';
        s.emoteT = 1;
        if (dist(s.pos, w.player.pos) < 1.4) {
          s.state = 'following';
          s.hop = 1;
          s.emote = 'happy';
          s.emoteT = 1.5;
          popup(w, s.pos, 60, 'Follow me to the fire!', '#ffe58a', true);
        }
        break;
      case 'following': {
        // Stay close behind the player: re-plan often, keep walking instead of
        // stopping dead, and hurry when falling behind (the player is faster).
        const gap = dist(s.pos, w.player.pos);
        s.idleT -= dt;
        if (s.idleT <= 0) {
          s.idleT = 0.15;
          const pv = w.player.vel;
          const sp = Math.hypot(pv.x, pv.y);
          const behind = sp > 0.3
            ? { x: w.player.pos.x - (pv.x / sp) * 0.7, y: w.player.pos.y - (pv.y / sp) * 0.7 }
            : w.player.pos;
          s.route = gap > 0.75 ? planRoute(w.base, s.pos, behind) : [];
        }
        // Lost far behind (stuck on a corner): catch up along a fresh route.
        if (gap > 7) s.route = planRoute(w.base, s.pos, w.player.pos);
        followRoute(s, dt, clamp(gap / 1.4, 0.75, 1.45));
        // Rescued once the survivor is in the fire's warmth (inside the walls),
        // or right beside the player while the player stands by the fire.
        const fire = w.structures.campfire.pos;
        const warm = Math.max(2.6, warmRadius(w) * 0.75);
        const nearFire = dist(s.pos, fire) < warm || (dist(w.player.pos, fire) < warm && gap < 1.6);
        if (w.base.isInside(s.pos.x, s.pos.y) && nearFire) {
          // Rescued: warms up and becomes the camp's first worker.
          w.stats.rescued++;
          buildStructure(w, 'woodpile');
          spawnWorker(w, 'lumberjack', s.pos);
          celebrate(w, s.pos, 'Rescued! A lumberjack joins you');
          s.state = 'leaving';
          s.route = [];
        }
        break;
      }
      case 'arriving':
        if (followRoute(s, dt)) s.state = 'queue';
        break;
      case 'queue':
        brake(s, dt);
        s.lookAt = counter.pos;
        s.patience -= dt * (blizzard ? 3 : 1);
        if ((cold || blizzard) && !s.emote && w.rng() < dt * 0.25) emote(s, 'cold');
        if (s.patience <= 0) {
          emote(s, 'cold', 2);
          s.state = 'leaving';
          s.route = [{ x: 26.6, y: 28.6 }, SPOTS.roadEnd];
          w.morale = Math.max(0, w.morale - 2);
          reslot(w);
        }
        break;
      case 'served':
        brake(s, dt);
        s.idleT -= dt;
        if (s.idleT > 0) break;
        if (w.structures.shelter.built && residents(w) < MAX_RESIDENTS && w.rng() < 0.5) {
          s.state = 'resident';
          s.route = planRoute(w.base, s.pos, residentSpot(w));
          emote(s, 'happy', 2);
          popup(w, s.pos, 60, 'A survivor stays!', '#ffd34d');
          w.morale = Math.min(100, w.morale + 3);
        } else {
          s.state = 'leaving';
          s.route = [{ x: 26.6, y: 28.6 }, SPOTS.roadEnd];
        }
        break;
      case 'leaving':
        followRoute(s, dt);
        break;
      case 'resident':
        if (blizzard) {
          s.state = 'huddle';
          const c = w.structures.campfire.pos;
          const a = w.rng() * Math.PI * 2;
          s.route = planRoute(w.base, s.pos, { x: c.x + Math.cos(a) * 1.2, y: c.y + Math.sin(a) * 1.2 });
          emote(s, 'cold');
          break;
        }
        if (raid) {
          s.state = 'panic';
          s.route = planRoute(w.base, s.pos, w.structures.shelter.built ? w.structures.shelter.pos : w.structures.campfire.pos);
          emote(s, 'alarm', 2);
          break;
        }
        if (followRoute(s, dt, 0.5)) {
          s.idleT -= dt;
          s.lookAt = w.structures.campfire.pos;
          if (s.idleT <= 0) {
            s.idleT = 3 + w.rng() * 5;
            s.route = planRoute(w.base, s.pos, residentSpot(w));
            if (cold && w.rng() < 0.4) emote(s, 'zzz', 2.5);
          }
        }
        break;
      case 'huddle':
        if (followRoute(s, dt)) s.lookAt = w.structures.campfire.pos;
        if (!blizzard) {
          s.state = 'resident';
          emote(s, 'happy');
        }
        break;
      case 'panic':
        followRoute(s, dt, 1.3);
        if (!raid) {
          s.state = 'resident';
          s.route = planRoute(w.base, s.pos, residentSpot(w));
        }
        break;
    }
    updateMotion(s, dt, w, { mouthZ: 34 });
  }
  w.survivors = w.survivors.filter((s) => !(s.state === 'leaving' && s.route.length === 0));
}

/* ---------------- Morale ---------------- */

/** 0 = full day, 1 = deep night. Day ~60% of the cycle, with dusk and dawn ramps. */
export function nightAmount(w: World): number {
  if (!w.day.active) return 0;
  const t = w.day.t / w.day.length;
  const sm = (x: number) => x * x * (3 - 2 * x);
  if (t < 0.6) return 0;
  if (t < 0.7) return sm((t - 0.6) / 0.1);
  if (t < 0.92) return 1;
  return 1 - sm((t - 0.92) / 0.08);
}

export function updateMorale(w: World, dt: number): void {
  let target = 55;
  if (w.fire.lit) target += 10;
  if (w.structures.shelter.built) target += 12;
  target += residents(w) * 2;
  if (w.event?.kind === 'blizzard') target -= 25;
  if (w.defense.waveActive) target -= 15;
  if (w.player.knockedT > 0) target -= 10;
  w.morale += clamp(target - w.morale, -1, 1) * dt * 0.8;
  w.morale = clamp(w.morale, 0, 100);
}

export function warmAt(w: World, p: Vec): boolean {
  return w.fire.lit && dist(p, w.structures.campfire.pos) < warmRadius(w);
}

