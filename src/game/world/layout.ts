import { BASE_CENTER, ELDER_WOOD, MAP_SIZE, NODE_AMOUNT } from '../core/constants';
import { dist } from '../core/math';
import type { QuadrantId, ResourceNode, Vec } from '../core/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A gate is a set of boundary edges left open in the stockade.
 * Edge keys: `h:x:y` = edge on line y spanning x..x+1,
 *            `v:x:y` = edge on line x spanning y..y+1.
 */
export interface GateDef {
  id: string;
  edges: string[];
  inPoint: Vec;
  outPoint: Vec;
}

export interface QuadrantDef {
  id: QuadrantId;
  rect: Rect;
  gates: GateDef[];
  /** Openings in the stockade that are not walkable routes (serving hatch). */
  hatches?: string[];
}

export const QUADRANTS: Record<QuadrantId, QuadrantDef> = {
  core: {
    id: 'core',
    rect: { x: 16, y: 16, w: 8, h: 8 },
    gates: [
      { id: 'south', edges: ['h:19:24', 'h:20:24'], inPoint: { x: 20, y: 23.3 }, outPoint: { x: 20, y: 25.1 } },
    ],
    hatches: ['h:22:24'],
  },
  east: {
    id: 'east',
    rect: { x: 24, y: 16, w: 8, h: 8 },
    gates: [{ id: 'east', edges: ['v:32:19', 'v:32:20'], inPoint: { x: 31.3, y: 20 }, outPoint: { x: 33.1, y: 20 } }],
  },
  west: {
    id: 'west',
    rect: { x: 8, y: 16, w: 8, h: 8 },
    gates: [{ id: 'west', edges: ['v:8:19', 'v:8:20'], inPoint: { x: 8.7, y: 20 }, outPoint: { x: 6.9, y: 20 } }],
  },
  north: {
    id: 'north',
    rect: { x: 16, y: 8, w: 8, h: 8 },
    gates: [{ id: 'north', edges: ['h:19:8', 'h:20:8'], inPoint: { x: 20, y: 8.7 }, outPoint: { x: 20, y: 6.9 } }],
  },
};

/** Fixed placements for every structure and pad. */
export const SPOTS = {
  playerStart: { x: 20.3, y: 21.6 },
  campfire: { x: 20, y: 20 },
  hub: { x: 20.4, y: 21.6 },
  // Kitchen loop (core).
  fishPond: { x: 17.6, y: 21.3 },
  fishSpot: { x: 18.55, y: 21.3 },
  grill: { x: 21.5, y: 17.5 },
  counter: { x: 22.5, y: 24.0 },
  counterServe: { x: 22.5, y: 23.35 },
  cashPad: { x: 23.4, y: 22.4 },
  // Survivors queue outside the south wall, then walk the road.
  queueHead: { x: 22.5, y: 24.9 },
  roadEnd: { x: 26.6, y: 43.5 },
  // Buildings.
  lumberHut: { x: 17.5, y: 17.4 },
  woodpile: { x: 19.4, y: 16.9 },
  fishShack: { x: 18.0, y: 19.4 },
  expandEast: { x: 23.1, y: 19.4 },
  tradingPost: { x: 27.6, y: 17.8 },
  tradeMat: { x: 27.6, y: 19.9 },
  quarryCamp: { x: 29.8, y: 22.4 },
  stonepile: { x: 26.0, y: 22.5 },
  tower1: { x: 16.9, y: 23.1 },
  expandNorth: { x: 20.0, y: 16.8 },
  tower2: { x: 30.8, y: 17.2 },
  workshop: { x: 17.9, y: 10.3 },
  shelter: { x: 22.2, y: 10.3 },
  sharpAxes: { x: 17.5, y: 13.0 },
  bigPacks: { x: 22.6, y: 13.0 },
  ironArrows: { x: 17.5, y: 14.7 },
  traps: { x: 29.2, y: 20.4 },
  gatehouse: { x: 25.0, y: 17.2 },
  caravanStop: { x: 26.0, y: 20.5 },
  caravanHire: { x: 24.8, y: 22.0 },
  caravanEntry: { x: 43.5, y: 20.2 },
  stranded: { x: 20.9, y: 27.3 },
  bonfire: { x: 21.6, y: 21.3 },
  // Station upgrade pads, each beside its station.
  upGrill: { x: 23.0, y: 17.1 },
  upHatch: { x: 21.0, y: 23.3 },
  upFishing: { x: 16.9, y: 20.0 },
  upLumber: { x: 19.2, y: 18.4 },
  // Chapter 2: the west yard and the frozen lake beyond it.
  expandWest: { x: 14.9, y: 20.0 },
  smokehouse: { x: 12.4, y: 18.0 },
  smokeDrop: { x: 12.5, y: 19.3 },
  market: { x: 10.4, y: 22.2 },
  marketMat: { x: 12.0, y: 22.6 },
  lakeCamp: { x: 9.7, y: 17.4 },
  upSmoke: { x: 14.2, y: 17.2 },
  porter: { x: 13.9, y: 21.0 },
  tower3: { x: 8.9, y: 23.2 },
} satisfies Record<string, Vec>;

const ROCK_ZONE: Rect = { x: 34, y: 15, w: 6.5, h: 10 };

/** The frozen lake west of the camp (world-space ellipse), revealed in Chapter 2. */
export const LAKE = { x: 3.9, y: 20, rx: 2.75, ry: 5.4 };
export const ICE_HOLES: Vec[] = [
  { x: 3.1, y: 16.6 },
  { x: 4.9, y: 18.3 },
  { x: 2.6, y: 20.4 },
  { x: 4.7, y: 22.0 },
  { x: 3.3, y: 23.6 },
];

export function inLake(x: number, y: number, margin = 0): boolean {
  const dx = (x - LAKE.x) / (LAKE.rx + margin);
  const dy = (y - LAKE.y) / (LAKE.ry + margin);
  return dx * dx + dy * dy < 1;
}

/** Queue positions outside the serving hatch, snaking toward the road. */
export function queueSlot(i: number): Vec {
  const h = SPOTS.queueHead;
  if (i < 3) return { x: h.x + i * 0.75, y: h.y + i * 0.35 };
  return { x: h.x + 1.5 + (i - 2) * 0.55, y: h.y + 0.7 + (i - 2) * 0.75 };
}

export function inQueueLane(x: number, y: number): boolean {
  if (x > 21.2 && x < 28.6 && y > 24.2 && y < 30.5) return true;
  return x > 25.2 && x < 28.2 && y > 28 && y < 46;
}

const inRect = (r: Rect, x: number, y: number, m = 0) =>
  x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;

/** Trees ring the base (with decorative forest beyond the map edge); rocks sit east. */
export function generateNodes(rng: () => number): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  let id = 1;
  // The west yard keeps its forest until Chapter 2 clears it.
  const rects = Object.values(QUADRANTS).filter((q) => q.id !== 'west').map((q) => q.rect);
  const gateOuts = Object.values(QUADRANTS).flatMap((q) => q.gates.map((g) => g.outPoint));
  const taken: Vec[] = [];
  const free = (x: number, y: number, d: number) => taken.every((t) => Math.hypot(t.x - x, t.y - y) >= d);

  const addTree = (x: number, y: number, interactive: boolean, elder = false) => {
    taken.push({ x, y });
    const amount = elder ? ELDER_WOOD : NODE_AMOUNT.tree;
    nodes.push({
      id: id++,
      kind: 'tree',
      pos: { x, y },
      amount,
      max: amount,
      regrowT: 0,
      shake: 0,
      claimedBy: null,
      visible: true,
      interactive,
      variant: elder ? 5 : Math.floor(rng() * 5),
      popT: 0,
      elder,
    });
  };
  const farOut = (x: number, y: number) => Math.hypot(x - BASE_CENTER.x, y - BASE_CENTER.y) > 13;

  // A friendly starter grove just outside the south and west gates.
  const starters: [number, number][] = [
    [18.3, 26.2], [16.9, 27.3], [19.0, 27.9], [15.6, 25.6], [17.6, 29.0], [14.8, 27.6],
  ];
  for (const [x, y] of starters) addTree(x, y, true);

  for (let gy = -7; gy < MAP_SIZE + 7; gy += 1.15) {
    for (let gx = -7; gx < MAP_SIZE + 7; gx += 1.15) {
      const x = gx + (rng() - 0.5) * 0.9;
      const y = gy + (rng() - 0.5) * 0.9;
      if (rects.some((r) => inRect(r, x, y, 1.3))) continue;
      if (gateOuts.some((g) => Math.hypot(g.x - x, g.y - y) < 1.9)) continue;
      if (inRect(ROCK_ZONE, x, y, 0.8)) continue;
      // Keep the corridor between the east gate and the quarry open.
      if (x > 32 && x < 35 && y > 18 && y < 22) continue;
      // Survivor queue lane and the road south.
      if (inQueueLane(x, y)) continue;
      const inMap = x >= 1.5 && x <= MAP_SIZE - 1.5 && y >= 1.5 && y <= MAP_SIZE - 1.5;
      const nearBase = Math.hypot(x - 22, y - 19) < 13;
      const density = inMap ? (nearBase ? 0.24 : 0.5) : 0.85;
      if (rng() > density) continue;
      const elder = inMap && farOut(x, y) && rng() < 0.07;
      if (!free(x, y, elder ? 1.4 : 0.95)) continue;
      addTree(x, y, inMap, elder);
    }
  }

  // Rocks: hidden until stone mining unlocks.
  const addRock = (kind: 'rock' | 'ore', x: number, y: number) => {
    taken.push({ x, y });
    nodes.push({
      id: id++,
      kind,
      pos: { x, y },
      amount: NODE_AMOUNT[kind],
      max: NODE_AMOUNT[kind],
      regrowT: 0,
      shake: 0,
      claimedBy: null,
      visible: false,
      interactive: true,
      variant: Math.floor(rng() * (kind === 'rock' ? 5 : 3)),
      popT: 0,
      elder: kind === 'ore',
    });
  };
  let placed = 0;
  for (let i = 0; i < 400 && placed < 12; i++) {
    const x = ROCK_ZONE.x + rng() * ROCK_ZONE.w;
    const y = ROCK_ZONE.y + rng() * ROCK_ZONE.h;
    if (!free(x, y, 1.35)) continue;
    if (dist({ x, y }, QUADRANTS.east.gates[0].outPoint) < 1.8) continue;
    addRock('rock', x, y);
    placed++;
  }

  // Iron ore: rich, dangerous finds out in the wilds (revealed with predators).
  let ore = 0;
  for (let i = 0; i < 2000 && ore < 10; i++) {
    const x = 3 + rng() * (MAP_SIZE - 6);
    const y = 3 + rng() * (MAP_SIZE - 6);
    const d = Math.hypot(x - BASE_CENTER.x, y - BASE_CENTER.y);
    if (d < 13.5 || d > 21) continue;
    if (inRect(ROCK_ZONE, x, y, 1)) continue;
    if (gateOuts.some((g) => Math.hypot(g.x - x, g.y - y) < 3) || inQueueLane(x, y)) continue;
    if (nodes.some((n) => n.kind !== 'tree' && Math.hypot(n.pos.x - x, n.pos.y - y) < 4)) continue;
    // Clear the trees around it so it reads as a clearing.
    for (let j = nodes.length - 1; j >= 0; j--) {
      const n = nodes[j];
      if (n.kind === 'tree' && n.interactive && Math.hypot(n.pos.x - x, n.pos.y - y) < 1.3) nodes.splice(j, 1);
    }
    addRock('ore', x, y);
    ore++;
  }
  return nodes;
}
