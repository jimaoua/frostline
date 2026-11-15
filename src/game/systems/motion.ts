import { FOOTPRINT_STEP, MAX_FOOTPRINTS } from '../core/constants';
import { screenDirToWorldDir, worldVecToScreenAngle } from '../core/iso';
import { angleLerp, clamp, damp } from '../core/math';
import type { Mover, Vec, World } from '../core/types';
import { sfx } from './effects';

export const MOVE_EPS = 0.18;

export function makeMover(pos: Vec, speed: number): Mover {
  return {
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    speed,
    facing: Math.PI / 2,
    flip: 1,
    lean: 0,
    walkPhase: 0,
    stepAccum: 0,
    stepSide: 1,
    lookAt: null,
    breathT: Math.random() * 2,
    bumpAt: -10,
  };
}

export const isMoving = (m: Mover) => Math.hypot(m.vel.x, m.vel.y) > MOVE_EPS;

/** Accelerate toward a point. Returns true once arrived. */
export function steerToward(m: Mover, target: Vec, dt: number, accel = 9, speedScale = 1): boolean {
  const dx = target.x - m.pos.x;
  const dy = target.y - m.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.1) {
    brake(m, dt);
    return true;
  }
  const s = m.speed * speedScale * Math.min(1, 0.35 + d / 0.6);
  const k = damp(accel, dt);
  m.vel.x += ((dx / d) * s - m.vel.x) * k;
  m.vel.y += ((dy / d) * s - m.vel.y) * k;
  m.pos.x += m.vel.x * dt;
  m.pos.y += m.vel.y * dt;
  return false;
}

export function brake(m: Mover, dt: number, rate = 12): void {
  const k = damp(rate, dt);
  m.vel.x -= m.vel.x * k;
  m.vel.y -= m.vel.y * k;
  m.pos.x += m.vel.x * dt;
  m.pos.y += m.vel.y * dt;
}

/** Walk a waypoint list. Returns true when the final waypoint is reached. */
export function followRoute(m: Mover & { route: Vec[] }, dt: number, speedScale = 1): boolean {
  while (m.route.length) {
    const last = m.route.length === 1;
    const t = m.route[0];
    const d = Math.hypot(t.x - m.pos.x, t.y - m.pos.y);
    if (d < (last ? 0.12 : 0.35)) {
      m.route.shift();
      continue;
    }
    steerToward(m, t, dt, 9, speedScale);
    return false;
  }
  brake(m, dt);
  return true;
}

export interface MotionOpts {
  paw?: boolean;
  big?: boolean;
  /** Height of the mouth for cold-breath puffs (world-px); 0 disables. */
  mouthZ?: number;
}

/**
 * Shared animation state for every walker: turns the body toward the exact
 * screen-space movement vector (or toward what it is working on when still),
 * flips with hysteresis, leans into motion, breathes in the cold and leaves
 * footprints behind.
 */
export function updateMotion(m: Mover, dt: number, w: World | null, o: MotionOpts = {}): void {
  const speed = Math.hypot(m.vel.x, m.vel.y);
  const moving = speed > MOVE_EPS;
  let target = m.facing;
  if (moving) target = worldVecToScreenAngle(m.vel.x, m.vel.y);
  else if (m.lookAt) target = worldVecToScreenAngle(m.lookAt.x - m.pos.x, m.lookAt.y - m.pos.y);
  m.facing = angleLerp(m.facing, target, damp(14, dt));

  const fx = Math.cos(m.facing);
  if (fx > 0.15) m.flip = 1;
  else if (fx < -0.15) m.flip = -1;

  const leanTarget = moving ? fx * 0.16 * clamp(speed / m.speed, 0, 1) : 0;
  m.lean += (leanTarget - m.lean) * damp(10, dt);
  if (moving) m.walkPhase += dt * (5 + speed * 3.2);

  if (!w) return;

  // Visible breath in the cold.
  m.breathT -= dt * (moving ? 1.6 : 1);
  if (o.mouthZ && m.breathT <= 0) {
    m.breathT = 1.8 + w.rng() * 1.2;
    const f = screenDirToWorldDir(Math.cos(m.facing), Math.sin(m.facing));
    w.particles.push({
      kind: 'breath',
      x: m.pos.x + f.x * 0.16,
      y: m.pos.y + f.y * 0.16,
      z: o.mouthZ,
      vx: f.x * 0.35 + m.vel.x * 0.4,
      vy: f.y * 0.35 + m.vel.y * 0.4,
      vz: 6,
      life: 1.1,
      maxLife: 1.1,
      size: 3,
      color: '#ffffff',
      spin: 0,
    });
  }

  if (moving) {
    m.stepAccum += speed * dt;
    if (m.stepAccum >= (o.paw ? 0.24 : FOOTPRINT_STEP) * (o.big ? 1.5 : 1)) {
      m.stepAccum = 0;
      m.stepSide = m.stepSide === 1 ? -1 : 1;
      const nx = -m.vel.y / speed;
      const ny = m.vel.x / speed;
      const off = (o.paw ? 0.05 : 0.075) * (o.big ? 1.8 : 1) * m.stepSide;
      w.footprints.push({
        x: m.pos.x + nx * off,
        y: m.pos.y + ny * off,
        angle: Math.atan2(m.vel.y, m.vel.x),
        age: 0,
        paw: !!o.paw,
        big: !!o.big,
      });
      if (m === w.player) sfx(w, 'step');
      if (w.footprints.length > MAX_FOOTPRINTS) w.footprints.splice(0, w.footprints.length - MAX_FOOTPRINTS);
    }
  }
}
