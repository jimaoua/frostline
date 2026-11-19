import { DAY_LENGTH, GRILL_SLOTS, MORALE_START, PLAYER_CAPACITY, PLAYER_HP, PLAYER_SPEED, SMOKE_SLOTS } from '../core/constants';
import { mulberry32 } from '../core/math';
import type { Ghost, ItemKind, Pad, PadEffect, PadIcon, PadId, PadPart, Player, Stats, Structure, StructureId, Vec, World } from '../core/types';
import { makeMover } from '../systems/motion';
import { BaseLayout } from './base';
import { SPOTS, generateNodes } from './layout';
import { campXpFor } from '../systems/levels';

function structure(id: StructureId, pos: Vec, radius: number, built = false): Structure {
  return { id, pos: { ...pos }, radius, built, builtAt: -10, bumpAt: -10 };
}

function pad(
  id: PadId,
  label: string,
  icon: PadIcon,
  pos: Vec,
  size: number,
  kind: ItemKind,
  amount: number,
  effect: PadEffect,
  ghost: Ghost | null = null,
): Pad {
  return {
    id,
    label,
    icon,
    pos: { ...pos },
    size,
    cost: { kind, amount },
    paid: 0,
    active: false,
    locked: false,
    completed: false,
    activatedAt: 0,
    effect,
    ghost: ghost ? { ...ghost, at: { ...pos } } : null,
  };
}

export const emptyStats = (): Stats => ({
  woodDelivered: 0,
  stoneGathered: 0,
  coinsEarned: 0,
  wolvesKilled: 0,
  oreSold: 0,
  goldMined: 0,
  diamondsMined: 0,
  scoutsFound: 0,
  stormsWeathered: 0,
  fishCaught: 0,
  mealsCooked: 0,
  mealsServed: 0,
  rescued: 0,
  cashCollected: 0,
  salmonCaught: 0,
  salmonSmoked: 0,
  smokedSold: 0,
});

export function createWorld(seed = 7): World {
  const rng = mulberry32(seed);
  const player: Player = {
    ...makeMover(SPOTS.playerStart, PLAYER_SPEED),
    carry: [],
    capacity: PLAYER_CAPACITY,
    swing: 0,
    tool: 'axe',
    actionT: 0,
    transferT: 0,
    attackT: 0,
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    warmth: 100,
    hurtT: 0,
    safeT: 0,
    knockedT: 0,
  };
  const S = SPOTS;

  const w: World = {
    time: 0,
    phase: 1,
    stepIndex: 0,
    stepStart: emptyStats(),
    base: new BaseLayout(),
    player,
    workers: [],
    survivors: [],
    wolves: [],
    nodes: generateNodes(rng),
    structures: {
      campfire: structure('campfire', S.campfire, 0.55, true),
      fishPond: structure('fishPond', S.fishPond, 0),
      grill: structure('grill', S.grill, 0.55),
      counter: structure('counter', S.counter, 0.45),
      cashPad: structure('cashPad', S.cashPad, 0),
      lumberHut: structure('lumberHut', S.lumberHut, 0.95),
      woodpile: structure('woodpile', S.woodpile, 0),
      fishShack: structure('fishShack', S.fishShack, 0.7),
      tradingPost: structure('tradingPost', S.tradingPost, 0.95),
      tradeMat: structure('tradeMat', S.tradeMat, 0),
      quarryCamp: structure('quarryCamp', S.quarryCamp, 0.85),
      stonepile: structure('stonepile', S.stonepile, 0),
      stash: structure('stash', S.stash, 0),
      mineLodge: structure('mineLodge', S.mineLodge, 0.8),
      tower1: structure('tower1', S.tower1, 0.5),
      tower2: structure('tower2', S.tower2, 0.5),
      workshop: structure('workshop', S.workshop, 1.0),
      shelter: structure('shelter', S.shelter, 1.0),
      smokehouse: structure('smokehouse', S.smokehouse, 0.85),
      market: structure('market', S.market, 0.8),
      marketMat: structure('marketMat', S.marketMat, 0),
      lakeCamp: structure('lakeCamp', S.lakeCamp, 0.85),
      tower3: structure('tower3', S.tower3, 0.5),
    },
    pads: {
      grill: pad('grill', 'Fish Grill', 'grill', S.grill, 1.5, 'wood', 6, { type: 'build', structures: ['grill'] }, { w: 1.2, d: 0.8, h: 22 }),
      bonfire: pad('bonfire', 'Bonfire', 'fire', S.bonfire, 1.4, 'coin', 80, { type: 'upgrade', upgrade: 'bonfire' }),
      lumberHut: pad('lumberHut', 'Lumberjack Hut', 'hut', S.lumberHut, 1.8, 'coin', 120, { type: 'build', structures: ['lumberHut'] }, { w: 1.7, d: 1.4, h: 50 }),
      fishShack: pad('fishShack', "Fisher's Shack", 'fish', S.fishShack, 1.5, 'coin', 60, { type: 'build', structures: ['fishShack'] }, { w: 1.2, d: 1.0, h: 40 }),
      expandEast: pad('expandEast', 'East Yard', 'expand', S.expandEast, 1.5, 'coin', 300, { type: 'expand', quadrant: 'east' }),
      tradingPost: pad('tradingPost', 'Trading Post', 'trade', S.tradingPost, 1.8, 'wood', 14, { type: 'build', structures: ['tradingPost', 'tradeMat'] }, { w: 1.8, d: 1.4, h: 46 }),
      quarryCamp: pad('quarryCamp', 'Quarry Camp', 'pick', S.quarryCamp, 1.7, 'coin', 200, { type: 'build', structures: ['quarryCamp', 'stonepile'] }, { w: 1.5, d: 1.2, h: 34 }),
      tower1: pad('tower1', 'Watchtower', 'tower', S.tower1, 1.4, 'coin', 400, { type: 'build', structures: ['tower1'] }, { w: 1.05, d: 1.05, h: 100 }),
      expandNorth: pad('expandNorth', 'North Yard', 'expand', S.expandNorth, 1.5, 'coin', 600, { type: 'expand', quadrant: 'north' }),
      tower2: pad('tower2', 'Watchtower', 'tower', S.tower2, 1.4, 'coin', 600, { type: 'build', structures: ['tower2'] }, { w: 1.05, d: 1.05, h: 100 }),
      workshop: pad('workshop', 'Workshop', 'gear', S.workshop, 1.8, 'coin', 500, { type: 'build', structures: ['workshop'] }, { w: 1.8, d: 1.5, h: 52 }),
      sharpAxes: pad('sharpAxes', 'Sharp Axes', 'pick', S.sharpAxes, 1.4, 'coin', 200, { type: 'upgrade', upgrade: 'sharpAxes' }),
      bigPacks: pad('bigPacks', 'Big Packs', 'pack', S.bigPacks, 1.4, 'coin', 300, { type: 'upgrade', upgrade: 'bigPacks' }),
      ironArrows: pad('ironArrows', 'Iron Arrows', 'arrow', S.ironArrows, 1.4, 'coin', 350, { type: 'upgrade', upgrade: 'ironArrows' }),
      shelter: pad('shelter', 'Shelter', 'home', S.shelter, 1.8, 'coin', 450, { type: 'build', structures: ['shelter'] }, { w: 1.9, d: 1.5, h: 50 }),
      traps: pad('traps', 'Gate Traps', 'trap', S.traps, 1.4, 'coin', 300, { type: 'upgrade', upgrade: 'traps' }),
      gatehouse: pad('gatehouse', 'Gatehouse', 'gate', S.gatehouse, 1.4, 'coin', 500, { type: 'upgrade', upgrade: 'gatehouse' }),
      caravanHire: pad('caravanHire', 'Hire Survivor', 'person', S.caravanHire, 1.4, 'coin', 80, { type: 'hire' }),
      upGrill: { ...pad('upGrill', 'Faster Grill', 'grill', S.upGrill, 1.2, 'coin', 40, { type: 'level', station: 'grill' }), level: 2 },
      upHatch: { ...pad('upHatch', 'Tastier Meals', 'trade', S.upHatch, 1.2, 'coin', 90, { type: 'level', station: 'hatch' }), level: 2 },
      upFishing: { ...pad('upFishing', 'Better Nets', 'fish', S.upFishing, 1.2, 'coin', 120, { type: 'level', station: 'fishing' }), level: 2 },
      upLumber: { ...pad('upLumber', 'Sharper Saws', 'hut', S.upLumber, 1.2, 'coin', 150, { type: 'level', station: 'lumber' }), level: 2 },
      // Chapter 2: the frozen lake.
      expandWest: pad('expandWest', 'West Yard', 'expand', S.expandWest, 1.6, 'coin', 700, { type: 'expand', quadrant: 'west' }),
      smokehouse: pad('smokehouse', 'Smokehouse', 'grill', S.smokehouse, 1.7, 'coin', 250, { type: 'build', structures: ['smokehouse'] }, { w: 1.4, d: 1.1, h: 46 }),
      market: pad('market', 'Fish Market', 'trade', S.market, 1.6, 'coin', 350, { type: 'build', structures: ['market', 'marketMat'] }, { w: 1.5, d: 1.0, h: 40 }),
      lakeCamp: pad('lakeCamp', "Ice Fishers' Hut", 'fish', S.lakeCamp, 1.6, 'coin', 700, { type: 'build', structures: ['lakeCamp'] }, { w: 1.4, d: 1.1, h: 44 }),
      upSmoke: { ...pad('upSmoke', 'Bigger Smokehouse', 'grill', S.upSmoke, 1.2, 'coin', 400, { type: 'level', station: 'smoke' }), level: 2 },
      upStash: { ...pad('upStash', 'Bigger Stash', 'hut', S.upStash, 1.2, 'coin', 120, { type: 'level', station: 'stash' }), level: 2, parts: [{ kind: 'wood', amount: 20, paid: 0 }] },
      mineLodge: pad('mineLodge', "Miners' Lodge", 'hut', S.mineLodge, 1.5, 'coin', 400, { type: 'build', structures: ['mineLodge'] }, { w: 1.6, d: 1.4, h: 46 }),
      porter: pad('porter', 'Market Porter', 'person', S.porter, 1.3, 'coin', 400, { type: 'hireRole', role: 'porter' }),
      tower3: pad('tower3', 'Lake Watchtower', 'tower', S.tower3, 1.4, 'coin', 450, { type: 'build', structures: ['tower3'] }, { w: 1.05, d: 1.05, h: 100 }),
    },
    towers: [],
    traps: [],
    doors: {},
    upgrades: { bonfire: false, sharpAxes: false, bigPacks: false, ironArrows: false, traps: false, gatehouse: false },
    stock: { wood: 0, stone: 0, ore: 0, fish: 0, meal: 0, salmon: 0, smoked: 0, gold: 0, diamond: 0 },
    kitchen: { raw: 0, slots: Array(GRILL_SLOTS).fill(-1), tray: 0, counter: 0, cash: 0 },
    coins: 0,
    coinPile: 0,
    stash: {},
    info: null,
    smoke: { raw: 0, slots: Array(SMOKE_SLOTS).fill(-1), ready: 0 },
    marketCash: 0,
    fire: { lit: false, fuel: 0, litAt: -10 },
    defense: { visible: false, health: 100, maxHealth: 100, wave: 0, nextWaveIn: null, waveActive: false, wavesCleared: 0, autoWaves: false },
    stats: emptyStats(),
    flags: {
      lake: false,
      caveFound: false,
      cave: false,
      harvestWood: false,
      harvestStone: false,
      harvestOre: false,
      fishing: false,
      survivors: false,
      fireAcceptsWood: false,
      showResources: false,
      showMorale: false,
      wildlife: false,
      events: false,
    },
    morale: MORALE_START,
    weather: { windAngle: 2.6, windStrength: 0.3, gust: 0, intensity: 0, target: 0 },
    day: { active: false, t: 25, length: DAY_LENGTH, day: 1 },
    event: null,
    eventCooldown: 0,
    eventCount: 0,
    caravan: null,
    flare: null,
    wildSpawnT: 0,
    survivorSpawnT: 2,
    footprints: [],
    flyers: [],
    sfx: [],
    incomeRate: 0,
    particles: [],
    popups: [],
    arrows: [],
    nextId: 1000,
    rng,
    levels: { grill: 1, hatch: 1, fishing: 1, lumber: 1, smoke: 1, stash: 1 },
    camp: { level: 1, xp: 0, next: campXpFor(1) },
    toast: null,
    tutorial: { moved: 0 },
    guide: null,
    guideHand: true,
    gameOver: false,
    shake: 0,
    hitstop: 0,
    flash: 0,
  };
  applyBuildCosts(w);
  return w;
}


/**
 * Construction prices: buildings and expansions take real materials plus
 * some money (Stage 3 of the design doc). Station upgrades, hires and the
 * optional shop pads keep their money price. A material is only asked for
 * once it can be gathered (stone after the quarry opens, ore after the first
 * ore run).
 */
export const BUILD_COSTS: Partial<Record<PadId, { coin?: number; wood?: number; stone?: number; ore?: number }>> = {
  fishShack: { wood: 10, coin: 40 },
  bonfire: { wood: 12, coin: 40 },
  lumberHut: { wood: 15, coin: 60 },
  expandEast: { wood: 20, coin: 150 },
  quarryCamp: { wood: 20, coin: 100 },
  expandNorth: { wood: 20, stone: 15, coin: 250 },
  tower1: { wood: 12, stone: 10, coin: 150 },
  tower2: { stone: 12, ore: 3, coin: 200 },
  workshop: { wood: 20, stone: 15, coin: 200 },
  sharpAxes: { ore: 3, coin: 100 },
  shelter: { wood: 25, stone: 15 },
  traps: { ore: 4, coin: 150 },
  gatehouse: { stone: 20, ore: 4 },
  expandWest: { wood: 30, stone: 20, coin: 300 },
  tower3: { stone: 15, ore: 4 },
  smokehouse: { wood: 20, coin: 150 },
  market: { wood: 25, stone: 10, coin: 200 },
  lakeCamp: { wood: 30, stone: 20, coin: 300 },
  mineLodge: { wood: 30, stone: 20, ore: 6, coin: 400 },
};

/** The price a pad has in this version (used for new games and to update old saves). */
export function buildCostFor(id: PadId): { cost: Pad['cost']; parts: PadPart[] } | null {
  const c = BUILD_COSTS[id];
  if (!c) return null;
  const mats: PadPart[] = (['wood', 'stone', 'ore'] as const).filter((k) => (c[k] ?? 0) > 0).map((k) => ({ kind: k, amount: c[k]!, paid: 0 }));
  if (c.coin) return { cost: { kind: 'coin', amount: c.coin }, parts: mats };
  const [first, ...rest] = mats;
  return { cost: { kind: first.kind, amount: first.amount }, parts: rest };
}

function applyBuildCosts(w: World): void {
  for (const id of Object.keys(BUILD_COSTS) as PadId[]) {
    const c = buildCostFor(id)!;
    w.pads[id].cost = c.cost;
    w.pads[id].parts = c.parts;
  }
}
