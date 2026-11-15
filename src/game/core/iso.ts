import { HALF_H, HALF_W } from './constants';
import type { Vec } from './types';

/**
 * World axes: +x runs down-right on screen, +y runs down-left.
 * z is height in world-pixels (lifts things straight up the screen).
 */
export function toScreen(x: number, y: number, z = 0): Vec {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H - z };
}

export function screenToWorld(sx: number, sy: number): Vec {
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Screen-space heading of a world-space vector. */
export function worldVecToScreenAngle(vx: number, vy: number): number {
  return Math.atan2((vx + vy) * HALF_H, (vx - vy) * HALF_W);
}

/** Convert an on-screen direction (e.g. joystick) to a unit world vector. */
export function screenDirToWorldDir(dx: number, dy: number): Vec {
  const w = screenToWorld(dx, dy);
  const len = Math.hypot(w.x, w.y);
  return len > 1e-6 ? { x: w.x / len, y: w.y / len } : { x: 0, y: 0 };
}
