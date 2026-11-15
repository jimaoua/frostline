import { BASE_CENTER, MAP_MAX, MAP_MIN } from '../core/constants';
import { clamp, dist } from '../core/math';
import type { Vec, Wolf, World } from '../core/types';
import { makePredator } from './defense';
import { burst, popup, sfx } from './effects';
import { knockOut } from './player';
import { brake, steerToward, updateMotion } from './motion';
import { nightAmount } from './settlement';

const MAX_WOLVES = 3;
const MAX_BEARS = 1;

function outerSpot(w: World): Vec | null {
  for (let i = 0; i < 30; i++) {
    const a = w.rng() * Math.PI * 2;
    const r = 13 + w.rng() * 6;
    const p = { x: clamp(BASE_CENTER.x + Math.cos(a) * r, MAP_MIN + 1, MAP_MAX - 1), y: clamp(BASE_CENTER.y + Math.sin(a) * r, MAP_MIN + 1, MAP_MAX - 1) };
    if (dist(p, w.player.pos) > 8 && !w.base.isInside(p.x, p.y)) return p;
  }
  return null;
}

/** Spawn a guardian bear at a spot (used by scout missions). */
export function spawnGuardian(w: World, at: Vec): void {
  const b = makePredator(w, 'bear', { x: at.x + 1.2, y: at.y + 0.8 }, 'roam');
  b.home = { ...at };
  w.wolves.push(b);
}

/**
 * Predators that patrol the wilds outside the walls. They wander near a home
 * point, chase the player when they get close, and give up at the stockade.
 */
export function updateWildlife(w: World, dt: number): void {
  if (!w.flags.wildlife) return;
  const night = nightAmount(w);
  w.wildSpawnT -= dt;
  if (w.wildSpawnT <= 0) {
    w.wildSpawnT = 14;
    const roam = w.wolves.filter((x) => x.mode === 'roam');
    const wolves = roam.filter((x) => x.species === 'wolf').length;
    const bears = roam.filter((x) => x.species === 'bear').length;
    const spot = outerSpot(w);
    if (spot) {
      if (wolves < MAX_WOLVES + Math.round(night * 2)) w.wolves.push(makePredator(w, 'wolf', spot, 'roam'));
      else if (bears < MAX_BEARS) w.wolves.push(makePredator(w, 'bear', spot, 'roam'));
    }
  }

  const p = w.player;
  const playerOut = !w.base.isInside(p.pos.x, p.pos.y) && p.knockedT <= 0;
  for (const m of w.wolves) {
    if (m.mode !== 'roam') continue;
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.lunge = Math.max(0, m.lunge - dt * 4);
    m.lookAt = null;
    const bear = m.species === 'bear';
    const aggro = (bear ? 3.6 : 4.6) + night * 1.6;
    const d = dist(m.pos, p.pos);

    if (m.stunT > 0) {
      m.stunT -= dt;
      brake(m, dt);
    } else if (m.chasing) {
      if (!playerOut || d > aggro * 2.2 || dist(m.pos, m.home) > 10) {
        m.chasing = false;
      } else if (d > (bear ? 0.95 : 0.8)) {
        steerToward(m, p.pos, dt, 7, bear ? 1.1 : 1.35);
        if (w.base.isInside(m.pos.x, m.pos.y)) {
          // Never follow into the camp.
          m.pos.x -= m.vel.x * dt * 2;
          m.pos.y -= m.vel.y * dt * 2;
          m.chasing = false;
        }
      } else {
        brake(m, dt);
        m.lookAt = p.pos;
        m.attackT -= dt;
        if (m.attackT <= 0) {
          m.attackT = bear ? 1.2 : 0.8;
          m.lunge = 1;
          biteplayer(w, m);
        }
      }
    } else if (playerOut && d < aggro) {
      m.chasing = true;
      popup(w, m.pos, bear ? 64 : 44, '!', '#ff6b5a', true);
    } else {
      // Patrol around home.
      m.wanderT -= dt;
      const target = m.route[0];
      if (!target || m.wanderT <= 0) {
        m.wanderT = 3 + w.rng() * 4;
        const a = w.rng() * Math.PI * 2;
        const goal = { x: m.home.x + Math.cos(a) * 2.5, y: m.home.y + Math.sin(a) * 2.5 };
        m.route = w.base.isInside(goal.x, goal.y) ? [] : [goal];
      } else if (steerToward(m, target, dt, 5, 0.45)) {
        m.route = [];
      }
    }
    updateMotion(m, dt, w, { paw: true, big: bear });
  }
}

function biteplayer(w: World, m: Wolf): void {
  const p = w.player;
  const bear = m.species === 'bear';
  p.hp -= bear ? 24 : 9;
  p.hurtT = 0.35;
  p.safeT = 0;
  w.shake = Math.max(w.shake, bear ? 0.45 : 0.2);
  w.flash = Math.max(w.flash, bear ? 0.5 : 0.25);
  const dx = p.pos.x - m.pos.x;
  const dy = p.pos.y - m.pos.y;
  const len = Math.hypot(dx, dy) || 1;
  const kb = bear ? 0.7 : 0.3;
  w.base.slide(p.pos, (dx / len) * kb, (dy / len) * kb, 0.26);
  burst(w, 'puff', p.pos, 5, { color: '#ffffff', z: 20, speed: 1, up: 30, size: 6, life: 0.5 });
  popup(w, p.pos, 50, `-${bear ? 24 : 9}`, '#ff6b5a');
  sfx(w, 'hurt');
  // A bear swipe knocks a few items out of your arms.
  if (bear && p.carry.length) {
    const lost = p.carry.splice(Math.max(0, p.carry.length - 3), 3);
    burst(w, 'chip', p.pos, lost.length * 2, { color: '#c47e45', z: 26, speed: 1.6, up: 120, size: 3, life: 0.9 });
  }
  if (p.hp <= 0) knockOut(w);
}
