import { NODE_AMOUNT } from '../core/constants';
import { dist } from '../core/math';
import type { World } from '../core/types';
import { CAVE, GEM_VEINS, QUADRANTS, SPOTS, inCave } from '../world/layout';
import { burst, ring } from './effects';

/**
 * Chapter 8: the glittering cave at the foot of the mountain, north of the
 * north gate. Finding it clears the trees in front of the mountain and lays
 * out the gold and diamond veins (still dark); the Miners' Lodge lights the
 * cave and the veins can be mined by the hero only.
 */
export function revealCave(w: World): void {
  if (w.flags.caveFound) return;
  w.flags.caveFound = true;
  const gate = QUADRANTS.north.gates[0].outPoint;
  for (let i = w.nodes.length - 1; i >= 0; i--) {
    const n = w.nodes[i];
    if (n.kind === 'gold' || n.kind === 'diamond') continue;
    // The cave floor, the lodge plot, and a clear path from the north gate.
    const onPath = Math.abs(n.pos.x - gate.x) < 1.4 && n.pos.y < gate.y + 0.5 && n.pos.y > CAVE.y;
    // …and the forest behind the mountain, which would poke through the ridge.
    const behindRidge = n.pos.y < 2.4 && n.pos.x > 13 && n.pos.x < 27;
    if (inCave(n.pos.x, n.pos.y, 1.1) || onPath || behindRidge || dist(n.pos, SPOTS.mineLodge) < 1.9) {
      if (n.kind === 'tree' && dist(n.pos, w.player.pos) < 14) burst(w, 'puff', n.pos, 3, { color: '#ffffff', z: 20, speed: 1, up: 30, size: 8, life: 0.8 });
      w.nodes.splice(i, 1);
    }
  }
  let id = w.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  for (const v of GEM_VEINS) {
    w.nodes.push({
      id: id++,
      kind: v.kind,
      pos: { x: v.x, y: v.y },
      amount: NODE_AMOUNT[v.kind],
      max: NODE_AMOUNT[v.kind],
      regrowT: 0,
      shake: 0,
      claimedBy: null,
      visible: false,
      interactive: true,
      variant: id % 5,
      popT: 0,
      elder: false,
    });
  }
}

/** The Miners' Lodge is up: lanterns on, the veins sparkle and can be mined. */
export function lightCave(w: World): void {
  if (w.flags.cave) return;
  w.flags.cave = true;
  for (const n of w.nodes) {
    if (n.kind !== 'gold' && n.kind !== 'diamond') continue;
    n.visible = true;
    n.popT = 0.4 + w.rng() * 0.8;
    ring(w, n.pos, 0.8, n.kind === 'gold' ? '#ffd34d' : '#9ff3ff', 0.5);
  }
}
