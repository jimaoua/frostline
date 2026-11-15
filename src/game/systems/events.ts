import { BASE_CENTER, MAP_MAX, MAP_MIN } from '../core/constants';
import { clamp, dist } from '../core/math';
import type { EventKind, Vec, World } from '../core/types';
import { SPOTS } from '../world/layout';
import { spawnWorker } from './build';
import { addFlyer, burst, celebrate, popup, sfx } from './effects';
import { earn } from './interact';
import { followRoute, makeMover, updateMotion } from './motion';
import { knockOut } from './player';
import { planRoute } from './routing';
import { warmAt } from './settlement';
import { spawnGuardian } from './wildlife';

export const EVENT_INFO: Record<EventKind, { title: string; text: string }> = {
  blizzard: { title: 'Blizzard!', text: 'Huddle by the fire until it passes.' },
  caravan: { title: 'Trader caravan', text: 'Sell anything at the sled for double. Hire a survivor.' },
  scout: { title: 'Signal flare', text: 'Someone needs help out in the wilds. Beware the bear.' },
};

/* ---------------- Weather and the day cycle ---------------- */

export function updateWeather(w: World, dt: number): void {
  const wt = w.weather;
  wt.windAngle += Math.sin(w.time * 0.05) * dt * 0.05;
  if (w.rng() < dt * 0.08) wt.gust = 0.6 + w.rng() * 0.6;
  wt.gust = Math.max(0, wt.gust - dt * 0.35);
  wt.intensity += (wt.target - wt.intensity) * Math.min(1, dt * 0.6);
  wt.windStrength = 0.3 + wt.intensity * 1.8;

  if (!w.day.active && w.fire.lit) w.day.active = true;
  if (w.day.active) {
    w.day.t += dt;
    if (w.day.t >= w.day.length) {
      w.day.t -= w.day.length;
      w.day.day++;
      popup(w, w.player.pos, 80, `Day ${w.day.day}`, '#ffe58a', true);
      sfx(w, 'day');
    }
  }
}

/* ---------------- Event director ---------------- */

const SCRIPT: EventKind[] = ['caravan', 'blizzard', 'scout'];

function start(w: World, kind: EventKind): void {
  const dur = kind === 'blizzard' ? 26 : kind === 'caravan' ? 50 : 75;
  w.event = { kind, t: 0, dur, ok: true };
  w.eventCount++;
  if (kind === 'blizzard') {
    w.weather.target = 1;
    w.shake = 0.2;
  }
  if (kind === 'caravan') {
    const cv = { ...makeMover(SPOTS.caravanEntry, 1.6), route: planRoute(w.base, SPOTS.caravanEntry, SPOTS.caravanStop), state: 'arriving' as const, stop: { ...SPOTS.caravanStop } };
    w.caravan = cv;
  }
  if (kind === 'scout') {
    const flare = scoutSpot(w);
    w.flare = flare;
    spawnGuardian(w, flare);
  }
}

function scoutSpot(w: World): Vec {
  for (let i = 0; i < 40; i++) {
    const a = w.rng() * Math.PI * 2;
    const r = 13 + w.rng() * 5;
    const p = { x: clamp(BASE_CENTER.x + Math.cos(a) * r, MAP_MIN + 2, MAP_MAX - 2), y: clamp(BASE_CENTER.y + Math.sin(a) * r, MAP_MIN + 2, MAP_MAX - 2) };
    if (!w.base.isInside(p.x, p.y)) return p;
  }
  return { x: 8, y: 30 };
}

function finish(w: World): void {
  const e = w.event!;
  if (e.kind === 'blizzard') {
    w.weather.target = 0;
    if (e.ok) {
      w.stats.stormsWeathered++;
      w.morale = Math.min(100, w.morale + 8);
      popup(w, w.player.pos, 70, 'Storm weathered! +8 morale', '#ffe58a', true);
    }
  }
  if (e.kind === 'caravan' && w.caravan) {
    w.caravan.state = 'leaving';
    w.caravan.route = planRoute(w.base, w.caravan.pos, SPOTS.caravanEntry);
    const hire = w.pads.caravanHire;
    hire.active = false;
  }
  if (e.kind === 'scout' && w.flare) {
    w.flare = null;
    w.morale = Math.max(0, w.morale - 5);
    popup(w, w.player.pos, 70, 'The signal faded…', '#c9d6e6', true);
  }
  w.event = null;
  w.eventCooldown = 55 + w.rng() * 30;
}

export function updateEvents(w: World, dt: number): void {
  if (w.flags.events && !w.event) {
    w.eventCooldown -= dt;
    if (w.eventCooldown <= 0 && !w.defense.waveActive) {
      const kind = w.eventCount < SCRIPT.length ? SCRIPT[w.eventCount] : SCRIPT[Math.floor(w.rng() * SCRIPT.length)];
      start(w, kind);
    }
  }

  const e = w.event;
  const p = w.player;
  if (e) {
    e.t += dt;
    if (e.kind === 'blizzard') {
      if (warmAt(w, p.pos)) p.warmth = Math.min(100, p.warmth + 30 * dt);
      else p.warmth = Math.max(0, p.warmth - 7 * dt);
      if (p.warmth <= 0) {
        e.ok = false;
        p.hp -= 5 * dt;
        p.safeT = 0;
        if (p.hp <= 0) knockOut(w);
      }
    }
    if (e.kind === 'scout' && w.flare && dist(p.pos, w.flare) < 1.2) {
      const at = w.flare;
      w.flare = null;
      for (let i = 0; i < 6; i++) addFlyer(w, 'coin', at, 20, () => p.pos, 40, 0.4 + i * 0.07, 50, () => earn(w, 15));
      spawnWorker(w, 'lumberjack', { x: at.x + 0.6, y: at.y + 0.3 });
      w.stats.scoutsFound++;
      w.morale = Math.min(100, w.morale + 12);
      celebrate(w, at, 'Survivor rescued! +$90');
      e.t = e.dur;
    }
    if (e.t >= e.dur) finish(w);
  } else {
    p.warmth = Math.min(100, p.warmth + 20 * dt);
  }

  const cv = w.caravan;
  if (cv) {
    const arrived = followRoute(cv, dt);
    if (cv.state === 'arriving' && arrived) {
      cv.state = 'trading';
      cv.lookAt = w.structures.campfire.pos;
      const hire = w.pads.caravanHire;
      hire.completed = false;
      hire.paid = 0;
      hire.active = true;
      hire.activatedAt = w.time;
      burst(w, 'puff', cv.pos, 8, { color: '#ffffff', z: 6, speed: 1, up: 20, size: 7, life: 0.6 });
      popup(w, cv.pos, 70, 'Traders have arrived!', '#ffe58a', true);
    }
    if (cv.state === 'leaving' && arrived) w.caravan = null;
    updateMotion(cv, dt, w, { mouthZ: 34 });
  }
}
