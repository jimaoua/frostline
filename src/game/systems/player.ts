import { MAP_MAX, MAP_MIN, PLAYER_RADIUS } from '../core/constants';
import { clamp, damp } from '../core/math';
import type { Vec, World } from '../core/types';
import { SPOTS } from '../world/layout';
import { burst, popup, sfx } from './effects';
import { updateMotion } from './motion';

function pushOut(pos: Vec, c: Vec, minD: number): void {
  const dx = pos.x - c.x;
  const dy = pos.y - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 < 1e-8) return;
  const d = Math.sqrt(d2);
  pos.x += (dx / d) * (minD - d);
  pos.y += (dy / d) * (minD - d);
}

export function resolveColliders(w: World, pos: Vec, r: number): void {
  for (const s of Object.values(w.structures)) if (s.built && s.radius > 0) pushOut(pos, s.pos, s.radius + r);
  for (const n of w.nodes) {
    if (!n.visible || Math.abs(n.pos.x - pos.x) > 1.5 || Math.abs(n.pos.y - pos.y) > 1.5) continue;
    const rr = n.kind === 'tree' ? (n.amount > 0 ? (n.elder ? 0.36 : 0.26) : 0.18) : n.amount > 0 ? 0.42 : 0.2;
    pushOut(pos, n.pos, rr + r);
  }
  // The frozen pond is solid ice: walk around it.
  if (w.flags.fishing) pushOut(pos, w.structures.fishPond.pos, 0.7 + r);
}

/** Player is knocked out: drop everything, wake up by the fire. */
export function knockOut(w: World): void {
  const p = w.player;
  if (p.knockedT > 0) return;
  p.knockedT = 2.2;
  w.flash = 1;
  w.shake = 0.5;
  for (const item of p.carry) burst(w, 'chip', p.pos, 2, { color: item === 'wood' ? '#c47e45' : '#9aa6b4', z: 20, speed: 1.6, up: 120, size: 3, life: 1 });
  if (p.carry.length) popup(w, p.pos, 60, 'Dropped your load!', '#ff8b7a', true);
  sfx(w, 'drop');
  p.carry = [];
}

/** dir: world-space direction with magnitude 0..1 (analog). */
export function updatePlayer(w: World, dir: Vec, dt: number): void {
  const p = w.player;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.safeT += dt;

  if (p.knockedT > 0) {
    p.knockedT -= dt;
    p.vel.x = 0;
    p.vel.y = 0;
    if (p.knockedT <= 0) {
      p.pos = { ...SPOTS.playerStart };
      p.hp = p.maxHp * 0.6;
      p.warmth = 100;
      burst(w, 'puff', p.pos, 10, { color: '#ffffff', z: 10, speed: 1, up: 30, size: 8, life: 0.6 });
    }
    return;
  }

  const inside = w.base.isInside(p.pos.x, p.pos.y);
  const regen = inside ? 8 : p.safeT > 4 ? 1.5 : 0;
  p.hp = Math.min(p.maxHp, p.hp + regen * dt);

  const slow = p.warmth <= 0 ? 0.6 : 1;
  const k = damp(14, dt);
  p.vel.x += (dir.x * p.speed * slow - p.vel.x) * k;
  p.vel.y += (dir.y * p.speed * slow - p.vel.y) * k;
  w.base.slide(p.pos, p.vel.x * dt, p.vel.y * dt, PLAYER_RADIUS);
  resolveColliders(w, p.pos, PLAYER_RADIUS);
  p.pos.x = clamp(p.pos.x, MAP_MIN, MAP_MAX);
  p.pos.y = clamp(p.pos.y, MAP_MIN, MAP_MAX);
  p.swing = Math.max(0, p.swing - dt * 3.2);
  updateMotion(p, dt, w, { mouthZ: 36 });
}
