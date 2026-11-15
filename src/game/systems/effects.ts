import { ELDER_WOOD, FOOTPRINT_LIFE, NODE_AMOUNT, CASH_STACK_MAX } from '../core/constants';
import type { ItemKind, ParticleKind, Vec, World, Sfx } from '../core/types';

/** Queue a sound/haptic cue (played by the host; at most a few per frame). */
export function sfx(w: World, id: Sfx): void {
  if (w.sfx.length < 12) w.sfx.push(id);
}

export function addFlyer(
  w: World,
  kind: ItemKind,
  from: Vec,
  fromZ: number,
  to: Vec | (() => Vec),
  toZ: number,
  dur = 0.35,
  arc = 26,
  onLand?: () => void,
): void {
  w.flyers.push({ kind, from: { ...from }, fromZ, to, toZ, t: 0, dur, arc, spin: (w.rng() - 0.5) * 10, onLand });
}

/** Height (world-px) of the top of an armful of items. */
export const stackTopZ = (count: number) => 20 + count * 4.2;
/** Height of the top of the cash bundle stack on a back. */
export const cashTopZ = (coins: number) => 24 + Math.min(CASH_STACK_MAX, Math.ceil(coins / 10)) * 3.4;

export function burst(
  w: World,
  kind: ParticleKind,
  at: Vec,
  n: number,
  opts: { color: string | string[]; z?: number; speed?: number; up?: number; size?: number; life?: number },
): void {
  const speed = opts.speed ?? 1.2;
  for (let i = 0; i < n; i++) {
    const a = w.rng() * Math.PI * 2;
    const s = speed * (0.4 + w.rng() * 0.8);
    const life = (opts.life ?? 0.6) * (0.7 + w.rng() * 0.6);
    const color = Array.isArray(opts.color) ? opts.color[Math.floor(w.rng() * opts.color.length)] : opts.color;
    w.particles.push({
      kind,
      x: at.x,
      y: at.y,
      z: opts.z ?? 10,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      vz: (opts.up ?? 80) * (0.6 + w.rng() * 0.8),
      life,
      maxLife: life,
      size: (opts.size ?? 3) * (0.7 + w.rng() * 0.6),
      color,
      spin: (w.rng() - 0.5) * 14,
    });
  }
}

/** Expanding ground shockwave. */
export function ring(w: World, at: Vec, size = 1.6, color = '#ffffff', life = 0.5): void {
  w.particles.push({ kind: 'ring', x: at.x, y: at.y, z: 0, vx: 0, vy: 0, vz: 0, life, maxLife: life, size, color, spin: 0 });
}

export function popup(w: World, at: Vec, z: number, text: string, color = '#ffffff', big = false): void {
  w.popups.push({ x: at.x, y: at.y, z, text, color, t: 0, big });
}

/** Celebration used for every completed construction. */
export function celebrate(w: World, at: Vec, label: string): void {
  ring(w, at, 2.4, '#ffffff', 0.6);
  ring(w, at, 1.4, '#ffe58a', 0.45);
  burst(w, 'puff', at, 16, { color: '#ffffff', z: 4, speed: 1.8, up: 12, size: 10, life: 0.8 });
  burst(w, 'confetti', at, 26, { color: ['#ffd34d', '#6fdc8c', '#4aa3ff', '#ff7a6b', '#ffffff'], z: 30, speed: 1.6, up: 170, size: 3.2, life: 1.4 });
  popup(w, at, 70, label, '#ffe58a', true);
  sfx(w, 'build');
  w.shake = Math.max(w.shake, 0.35);
  w.hitstop = Math.max(w.hitstop, 0.07);
}

export function windVec(w: World): Vec {
  const s = w.weather.windStrength + w.weather.gust;
  return { x: Math.cos(w.weather.windAngle) * s, y: Math.sin(w.weather.windAngle) * s };
}

export function updateEffects(w: World, dt: number): void {
  for (const f of w.footprints) f.age += dt * (1 + w.weather.intensity * 2);
  if (w.footprints.length && w.footprints[0].age > FOOTPRINT_LIFE) {
    let i = 0;
    while (i < w.footprints.length && w.footprints[i].age > FOOTPRINT_LIFE) i++;
    w.footprints.splice(0, i);
  }

  for (const f of w.flyers) {
    f.t += dt;
    if (f.t >= f.dur && !f.landed) {
      f.landed = true;
      sfx(w, `land_${f.kind}` as Sfx);
    }
    if (f.t >= f.dur && f.onLand) {
      f.onLand();
      f.onLand = undefined;
    }
  }
  w.flyers = w.flyers.filter((f) => f.t < f.dur);

  for (const p of w.popups) p.t += dt;
  w.popups = w.popups.filter((p) => p.t < (p.big ? 1.6 : 1.0));

  const wind = windVec(w);
  for (const p of w.particles) {
    p.life -= dt;
    switch (p.kind) {
      case 'chip':
      case 'spark':
      case 'confetti':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vz -= (p.kind === 'confetti' ? 220 : 320) * dt;
        if (p.kind === 'confetti') {
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.vz = Math.max(p.vz, -55);
        }
        if (p.z < 0) {
          p.z = 0;
          p.vz = 0;
          p.vx *= 0.4;
          p.vy *= 0.4;
        }
        break;
      case 'breath':
      case 'smoke':
      case 'steam':
        p.x += (p.vx + wind.x * 0.5) * dt;
        p.y += (p.vy + wind.y * 0.5) * dt;
        p.z += p.vz * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
        break;
      case 'wisp':
        p.x += (p.vx + wind.x * 2.4) * dt;
        p.y += (p.vy + wind.y * 2.4) * dt;
        p.z += Math.sin(p.life * 6 + p.spin) * 6 * dt;
        break;
      case 'ring':
        break;
      default:
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vz *= 0.96;
    }
  }
  w.particles = w.particles.filter((p) => p.life > 0);

  for (const n of w.nodes) {
    if (n.shake > 0) n.shake = Math.max(0, n.shake - dt * 4);
    if (n.popT > 0) n.popT = Math.max(0, n.popT - dt);
    if (n.amount === 0 && n.visible) {
      n.regrowT -= dt;
      if (n.regrowT <= 0) {
        n.amount = n.elder && n.kind === 'tree' ? ELDER_WOOD : NODE_AMOUNT[n.kind];
        n.popT = 0.5;
      }
    }
  }

  // Ambient: embers off the fire, chimney smoke, ground wisps in the wind.
  if (w.fire.lit && w.rng() < dt * 7) {
    const c = w.structures.campfire.pos;
    w.particles.push({
      kind: 'ember',
      x: c.x + (w.rng() - 0.5) * 0.3,
      y: c.y + (w.rng() - 0.5) * 0.3,
      z: 22,
      vx: wind.x * 0.3 + (w.rng() - 0.5) * 0.2,
      vy: wind.y * 0.3 + (w.rng() - 0.5) * 0.2,
      vz: 34 + w.rng() * 25,
      life: 1.3,
      maxLife: 1.3,
      size: 1.6,
      color: '#ffb347',
      spin: 0,
    });
  }
  for (const id of ['lumberHut', 'shelter', 'workshop', 'fishShack'] as const) {
    const s = w.structures[id];
    if (!s.built || w.rng() > dt * 2.2) continue;
    const off = id === 'fishShack' ? { x: 0.3, y: -0.2, z: 50 } : { x: 0.45, y: -0.35, z: 66 };
    w.particles.push({
      kind: 'smoke',
      x: s.pos.x + off.x,
      y: s.pos.y + off.y,
      z: off.z,
      vx: 0,
      vy: 0,
      vz: 14,
      life: 2.4,
      maxLife: 2.4,
      size: 5,
      color: '#dfe6ee',
      spin: 0,
    });
  }
  const p = w.player.pos;
  if (w.rng() < dt * (1.5 + w.weather.intensity * 14 + w.weather.gust * 6)) {
    w.particles.push({
      kind: 'wisp',
      x: p.x + (w.rng() - 0.5) * 12 - wind.x * 3,
      y: p.y + (w.rng() - 0.5) * 12 - wind.y * 3,
      z: 2 + w.rng() * 6,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 1.6,
      maxLife: 1.6,
      size: 6 + w.rng() * 6,
      color: '#ffffff',
      spin: w.rng() * 6,
    });
  }

  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 2.5);
  if (w.flash > 0) w.flash = Math.max(0, w.flash - dt * 2);
}
