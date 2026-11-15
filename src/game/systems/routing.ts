import { dist } from '../core/math';
import type { Vec } from '../core/types';
import type { BaseLayout } from '../world/base';
import { SPOTS } from '../world/layout';

/** True when every sample along a→b is inside (or outside) the base. */
function lineStays(base: BaseLayout, a: Vec, b: Vec, inside: boolean): boolean {
  const n = Math.max(2, Math.ceil(dist(a, b) / 0.25));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (base.isInside(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) !== inside) return false;
  }
  return true;
}

const insideLeg = (base: BaseLayout, a: Vec, b: Vec): Vec[] => (lineStays(base, a, b, true) ? [b] : [SPOTS.hub, b]);

/**
 * Waypoint routing for NPCs: nobody walks through the stockade. Crossing the
 * wall always goes through the best gate; L-shaped bases route via the hub.
 */
export function planRoute(base: BaseLayout, from: Vec, to: Vec): Vec[] {
  const fromIn = base.isInside(from.x, from.y);
  const toIn = base.isInside(to.x, to.y);
  if (fromIn && toIn) return insideLeg(base, from, to);
  if (!fromIn && !toIn) return [to];

  let best = base.gates[0];
  let bestScore = Infinity;
  for (const g of base.gates) {
    const clear = fromIn ? lineStays(base, g.outPoint, to, false) : lineStays(base, from, g.outPoint, false);
    const score =
      (fromIn ? dist(from, g.inPoint) + dist(g.outPoint, to) : dist(from, g.outPoint) + dist(g.inPoint, to)) +
      (clear ? 0 : 30);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  // Already in the gateway (between its outer and inner points)? Don't walk
  // back to the near end first: that turned followers around in the gate.
  if (fromIn) {
    if (inGateway(from, best.inPoint, best.outPoint)) return [best.outPoint, to];
    return [...insideLeg(base, from, best.inPoint), best.outPoint, to];
  }
  if (inGateway(from, best.outPoint, best.inPoint)) return [best.inPoint, ...insideLeg(base, best.inPoint, to)];
  return [best.outPoint, best.inPoint, ...insideLeg(base, best.inPoint, to)];
}

/** True when p lies in the passage from `near` to `far` (past `near`, within the opening's width). */
function inGateway(p: Vec, near: Vec, far: Vec): boolean {
  const ax = far.x - near.x;
  const ay = far.y - near.y;
  const len2 = ax * ax + ay * ay;
  if (len2 < 1e-6) return false;
  const t = ((p.x - near.x) * ax + (p.y - near.y) * ay) / len2;
  if (t <= 0.02 || t > 1) return false;
  const cx = near.x + ax * t;
  const cy = near.y + ay * t;
  return Math.hypot(p.x - cx, p.y - cy) < 0.6;
}
