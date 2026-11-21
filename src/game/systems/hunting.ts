import { dist } from '../core/math';
import type { Deer, World } from '../core/types';
import { MEADOWS, MEADOW_R, inRiver } from '../world/layout';
import { addFlyer, burst, popup, ring, sfx, stackTopZ } from './effects';

/**
 * Pine Valley: deer graze in the meadows south of the lodge. Walk up and they
 * bolt, faster than you for a couple of seconds, then tire and slow down.
 * Catch one while it is winded and your swings bring it down: it drops meat
 * straight onto your stack. The meat runs through the same kitchen as fish.
 */

const MAX_DEER = 4;
const DEER_HP = 3;
const SPOOK_R = 2.6;
const FLEE_SPEED = 3.6;
const FLEE_T = 2.2;
const TIRED_SPEED = 1.3;
const TIRED_T = 1.9;
const GRAZE_SPEED = 0.55;
const LEASH = MEADOW_R + 2.6;
const HIT_R = 1.05;
const MEAT_PER_DEER = 2;
const RESPAWN_T = 5;

let respawnT = 1;

function spawnDeer(w: World, home = MEADOWS[Math.floor(w.rng() * MEADOWS.length)]): Deer {
  const a = w.rng() * Math.PI * 2;
  const r = MEADOW_R * (0.3 + w.rng() * 0.6);
  return {
    id: w.nextId++,
    pos: { x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r },
    vel: { x: 0, y: 0 },
    facing: w.rng() * Math.PI * 2,
    hp: DEER_HP,
    state: 'graze',
    t: 1 + w.rng() * 2,
    home: { ...home },
    hurtT: 0,
  };
}

export function updateHunting(w: World, dt: number): void {
  if (w.worldId !== 2 || !w.flags.hunting) return;
  const alive = w.deer.filter((d) => d.state !== 'dead').length;
  if (alive < MAX_DEER) {
    respawnT -= dt;
    if (respawnT <= 0 || w.deer.length === 0) {
      respawnT = RESPAWN_T;
      // Fill the emptier meadow first so both stay lively.
      const counts = MEADOWS.map((m) => w.deer.filter((d) => d.state !== 'dead' && d.home.x === m.x).length);
      const home = MEADOWS[counts[0] <= counts[1] ? 0 : 1];
      w.deer.push(spawnDeer(w, home));
    }
  }

  const p = w.player;
  for (const d of w.deer) {
    d.t -= dt;
    d.hurtT = Math.max(0, d.hurtT - dt);
    if (d.state === 'dead') continue;
    const toP = dist(d.pos, p.pos);
    let speed = 0;
    let dir = d.facing;

    if (d.state === 'graze') {
      if (toP < SPOOK_R) {
        d.state = 'flee';
        d.t = FLEE_T;
        burst(w, 'puff', d.pos, 4, { color: '#ffffff', z: 4, speed: 0.8, up: 30, size: 5, life: 0.4 });
      } else {
        // Amble about the meadow, pausing to graze.
        if (d.t <= 0) {
          d.t = 1.5 + w.rng() * 2.5;
          const back = dist(d.pos, d.home) > MEADOW_R * 0.8;
          d.facing = back ? Math.atan2(d.home.y - d.pos.y, d.home.x - d.pos.x) : w.rng() * Math.PI * 2;
        }
        speed = d.t > 1.2 ? GRAZE_SPEED : 0;
        dir = d.facing;
      }
    }
    if (d.state === 'flee' || d.state === 'tired') {
      // Run away from the player, curling back toward the meadow when too far out.
      dir = Math.atan2(d.pos.y - p.pos.y, d.pos.x - p.pos.x);
      const out = dist(d.pos, d.home);
      if (out > LEASH * 0.7) {
        const home = Math.atan2(d.home.y - d.pos.y, d.home.x - d.pos.x);
        const k = Math.min(1, (out - LEASH * 0.7) / (LEASH * 0.3));
        dir = mixAngle(dir, home, k * 0.85);
      }
      speed = d.state === 'flee' ? FLEE_SPEED : TIRED_SPEED;
      if (d.hurtT > 0) speed *= 0.3;
      if (d.t <= 0) {
        if (d.state === 'flee') {
          d.state = 'tired';
          d.t = TIRED_T;
        } else if (toP < SPOOK_R) {
          d.state = 'flee';
          d.t = FLEE_T * 0.8;
        } else {
          d.state = 'graze';
          d.t = 1;
        }
      }
      d.facing = dir;
    }
    const tx = Math.cos(dir) * speed;
    const ty = Math.sin(dir) * speed;
    const k = Math.min(1, dt * 8);
    d.vel.x += (tx - d.vel.x) * k;
    d.vel.y += (ty - d.vel.y) * k;
    const nx = d.pos.x + d.vel.x * dt;
    const ny = d.pos.y + d.vel.y * dt;
    // Deer stay out of the stockade and off the open river ice.
    if (!w.base.isInside(nx, ny) && !inRiver(nx, ny, 0.2) && dist({ x: nx, y: ny }, d.home) < LEASH) {
      d.pos.x = nx;
      d.pos.y = ny;
    } else {
      d.facing += Math.PI * 0.6;
    }
  }

  // The player swings at a deer in reach.
  if (p.knockedT <= 0 && p.attackT <= 0 && w.wolves.every((x) => x.hp <= 0 || dist(x.pos, p.pos) > 1.25)) {
    const near = w.deer.find((d) => d.state !== 'dead' && dist(d.pos, p.pos) < HIT_R);
    if (near) hitDeer(w, near);
  }

  // Clear fallen deer once their fall has played.
  if (w.deer.some((d) => d.state === 'dead' && d.t < -1.4)) w.deer = w.deer.filter((d) => d.state !== 'dead' || d.t >= -1.4);
}

function hitDeer(w: World, d: Deer): void {
  const p = w.player;
  p.lookAt = d.pos;
  p.attackT = 0.45;
  p.swing = 1;
  p.tool = 'axe';
  d.hp -= w.upgrades.sharpAxes ? 1.6 : 1;
  d.hurtT = 0.3;
  // A hit while it is still fresh keeps it running; a winded deer stays winded.
  if (d.state === 'graze') {
    d.state = 'flee';
    d.t = FLEE_T * 0.6;
  }
  burst(w, 'chip', d.pos, 4, { color: ['#e9d3b0', '#a8743f'], z: 14, speed: 1.2, up: 90, size: 2.6, life: 0.4 });
  sfx(w, 'hit');
  w.shake = Math.max(w.shake, 0.08);
  if (d.hp > 0) return;

  d.state = 'dead';
  d.t = 0;
  d.vel = { x: 0, y: 0 };
  w.stats.deerHunted++;
  w.hitstop = 0.06;
  w.shake = 0.22;
  ring(w, d.pos, 1.1, '#ffe2a8', 0.45);
  const room = Math.max(0, p.capacity - p.carry.length);
  const meat = Math.min(MEAT_PER_DEER, room);
  for (let i = 0; i < meat; i++) {
    p.carry.push('fish');
    addFlyer(w, 'fish', d.pos, 10, () => p.pos, stackTopZ(p.carry.length - meat + i + 1), 0.36 + i * 0.08, 44);
  }
  popup(w, d.pos, 40, meat > 0 ? `+${meat} meat` : 'Pack full!', meat > 0 ? '#ffd9a8' : '#ff8a7a', true);
  sfx(w, 'catch');
}

function mixAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
