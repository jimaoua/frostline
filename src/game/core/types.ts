import type { BaseLayout } from '../world/base';

export interface Vec {
  x: number;
  y: number;
}

/** Things that physically ride on a back. Cash is shown separately. */
export type Carryable = 'wood' | 'stone' | 'ore' | 'fish' | 'meal' | 'salmon' | 'smoked' | 'gold' | 'diamond';
export type ItemKind = Carryable | 'coin';
export type QuadrantId = 'core' | 'east' | 'north' | 'west';

export type StructureId =
  | 'campfire'
  | 'fishPond'
  | 'grill'
  | 'counter'
  | 'cashPad'
  | 'lumberHut'
  | 'woodpile'
  | 'fishShack'
  | 'tradingPost'
  | 'tradeMat'
  | 'quarryCamp'
  | 'stonepile'
  | 'stash'
  | 'mineLodge'
  | 'tower1'
  | 'tower2'
  | 'workshop'
  | 'shelter'
  | 'smokehouse'
  | 'market'
  | 'marketMat'
  | 'lakeCamp'
  | 'tower3';

export type UpgradeId = 'bonfire' | 'sharpAxes' | 'bigPacks' | 'ironArrows' | 'traps' | 'gatehouse';

export type PadId =
  | 'grill'
  | 'lumberHut'
  | 'fishShack'
  | 'expandEast'
  | 'tradingPost'
  | 'quarryCamp'
  | 'tower1'
  | 'expandNorth'
  | 'tower2'
  | 'workshop'
  | 'shelter'
  | 'caravanHire'
  | 'upGrill'
  | 'upHatch'
  | 'upFishing'
  | 'upLumber'
  | 'expandWest'
  | 'smokehouse'
  | 'market'
  | 'lakeCamp'
  | 'upSmoke'
  | 'porter'
  | 'tower3'
  | UpgradeId
  | 'upStash'
  | 'mineLodge';

/** Stations that level up through their own upgrade pad. */
export type StationId = 'grill' | 'hatch' | 'fishing' | 'lumber' | 'smoke' | 'stash';

/**
 * Anything that walks. Facing is a SCREEN-space angle so the renderer can
 * turn, flip and lean the sprite toward the exact on-screen movement vector.
 */
export interface Mover {
  pos: Vec;
  vel: Vec;
  speed: number;
  facing: number;
  flip: 1 | -1;
  lean: number;
  walkPhase: number;
  stepAccum: number;
  stepSide: 1 | -1;
  lookAt: Vec | null;
  breathT: number;
  bumpAt: number;
}

export interface Player extends Mover {
  carry: Carryable[];
  capacity: number;
  swing: number;
  tool: 'axe' | 'pick' | 'rod';
  actionT: number;
  transferT: number;
  attackT: number;
  hp: number;
  maxHp: number;
  warmth: number;
  hurtT: number;
  safeT: number;
  knockedT: number;
}

export type WorkerRole = 'lumberjack' | 'miner' | 'hauler' | 'fisher' | 'cook' | 'icefisher' | 'porter';
export type WorkerState = 'idle' | 'toNode' | 'working' | 'toDrop' | 'toPickup' | 'toSell' | 'wander' | 'huddle';

export interface Worker extends Mover {
  id: number;
  role: WorkerRole;
  state: WorkerState;
  route: Vec[];
  nodeId: number | null;
  carry: Carryable[];
  capacity: number;
  workT: number;
  swing: number;
  idleT: number;
  home: Vec;
  /** For cooks: what this trip is for. */
  job: 'toGrill' | 'toCounter' | null;
}

export type SurvivorState = 'stranded' | 'following' | 'arriving' | 'queue' | 'served' | 'leaving' | 'resident' | 'huddle' | 'panic';
export type Emote = 'heart' | 'cold' | 'alarm' | 'zzz' | 'happy' | null;

export interface Survivor extends Mover {
  id: number;
  state: SurvivorState;
  route: Vec[];
  slot: number;
  patience: number;
  emote: Emote;
  emoteT: number;
  hop: number;
  look: number; // outfit variant
  carryMeal: boolean;
  idleT: number;
}

export type NodeKind = 'tree' | 'rock' | 'ore' | 'icehole' | 'gold' | 'diamond';

export interface ResourceNode {
  id: number;
  kind: NodeKind;
  pos: Vec;
  amount: number;
  max: number;
  regrowT: number;
  shake: number;
  claimedBy: number | null;
  visible: boolean;
  interactive: boolean;
  variant: number;
  popT: number;
  /** Old-growth / rich nodes out in the wilds: player-only. */
  elder: boolean;
}

export interface Structure {
  id: StructureId;
  pos: Vec;
  radius: number;
  built: boolean;
  builtAt: number;
  bumpAt: number;
}

export type PadEffect =
  | { type: 'build'; structures: StructureId[] }
  | { type: 'expand'; quadrant: QuadrantId }
  | { type: 'upgrade'; upgrade: UpgradeId }
  | { type: 'hire' }
  | { type: 'level'; station: StationId }
  | { type: 'hireRole'; role: WorkerRole };

export type PadIcon =
  | 'hut' | 'expand' | 'trade' | 'pick' | 'tower' | 'gear' | 'home' | 'trap' | 'gate' | 'pack' | 'arrow' | 'person' | 'fish' | 'grill' | 'fire';

/** Blueprint footprint shown while a pad is waiting for payment. */
export interface Ghost {
  w: number;
  d: number;
  h: number;
}

export interface Pad {
  id: PadId;
  label: string;
  icon: PadIcon;
  pos: Vec;
  size: number;
  /** Main price (money when the pad takes money, else its first material). */
  cost: { kind: ItemKind; amount: number };
  paid: number;
  /** Extra materials the pad also needs (logs, stone, ore), each paid separately. */
  parts?: PadPart[];
  active: boolean;
  /** Shown greyed-out as "next unlock" before it can be paid. */
  locked: boolean;
  completed: boolean;
  activatedAt: number;
  effect: PadEffect;
  ghost: (Ghost & { at: Vec }) | null;
  /** Level pads: the level this payment buys (2, 3, ...). */
  level?: number;
  /** Level pads re-open once the player steps off them. */
  rearm?: boolean;
}

export type Species = 'wolf' | 'bear';

export interface Wolf extends Mover {
  id: number;
  species: Species;
  /** raid: pack heading for the fire. roam: predator patrolling the wilds. */
  mode: 'raid' | 'roam';
  hp: number;
  maxHp: number;
  route: Vec[];
  attackT: number;
  hurtT: number;
  lunge: number;
  stunT: number;
  home: Vec;
  chasing: boolean;
  wanderT: number;
}

export interface Tower {
  id: StructureId;
  pos: Vec;
  cooldown: number;
  aim: number;
}

export interface Trap {
  pos: Vec;
  armed: boolean;
  rearmT: number;
  snapAt: number;
}

export interface GateDoor {
  hp: number;
  max: number;
  open: number;
  hitAt: number;
}

export interface Arrow {
  pos: Vec;
  z: number;
  z0: number;
  startDist: number;
  targetId: number;
  damage: number;
  angle: number;
}

export interface Footprint {
  x: number;
  y: number;
  angle: number;
  age: number;
  paw: boolean;
  big: boolean;
}

export interface Deer {
  id: number;
  pos: Vec;
  vel: Vec;
  facing: number;
  hp: number;
  state: 'graze' | 'flee' | 'tired' | 'dead';
  /** Seconds left in the current state (flee sprint, tired pause, corpse fade). */
  t: number;
  /** The meadow it lives in. */
  home: Vec;
  hurtT: number;
}

export interface PadPart {
  kind: ItemKind;
  amount: number;
  paid: number;
}

export interface Flyer {
  kind: ItemKind;
  from: Vec;
  fromZ: number;
  to: Vec | (() => Vec);
  toZ: number;
  t: number;
  dur: number;
  arc: number;
  spin: number;
  onLand?: () => void;
  landed?: boolean;
}

/** Sound/haptic cues raised by the simulation, played by the host (Game). */
export type Sfx =
  | 'step'
  | 'chop'
  | 'mine'
  | 'catch'
  | 'land_wood'
  | 'land_fish'
  | 'land_meal'
  | 'land_coin'
  | 'land_stone'
  | 'land_ore'
  | 'land_salmon'
  | 'land_smoked'
  | 'build'
  | 'upgrade'
  | 'mission'
  | 'levelup'
  | 'fire'
  | 'cooked'
  | 'hit'
  | 'hurt'
  | 'howl'
  | 'drop'
  | 'day'
  /** A construction pad reached 25 / 50 / 75 %. */
  | 'stage'
  /** The stack on your back just hit its limit. */
  | 'full';

export type ParticleKind = 'puff' | 'chip' | 'spark' | 'ember' | 'ring' | 'confetti' | 'breath' | 'wisp' | 'smoke' | 'steam';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  spin: number;
}

export interface Popup {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  t: number;
  big: boolean;
}

export interface Defense {
  visible: boolean;
  health: number;
  maxHealth: number;
  wave: number;
  nextWaveIn: number | null;
  waveActive: boolean;
  wavesCleared: number;
  autoWaves: boolean;
}

export interface Stats {
  woodDelivered: number;
  stoneGathered: number;
  coinsEarned: number;
  wolvesKilled: number;
  oreSold: number;
  deerHunted: number;
  goldMined: number;
  diamondsMined: number;
  scoutsFound: number;
  stormsWeathered: number;
  fishCaught: number;
  mealsCooked: number;
  mealsServed: number;
  rescued: number;
  cashCollected: number;
  salmonCaught: number;
  salmonSmoked: number;
  smokedSold: number;
}

export interface Flags {
  /** Chapter 2: the frozen lake west of the camp is revealed. */
  lake: boolean;
  /** Chapter 8: the cave north of the camp has been found (trees cleared, veins placed). */
  caveFound: boolean;
  /** Chapter 8: the Miners' Lodge lights the cave; gold and diamonds can be mined. */
  cave: boolean;
  harvestWood: boolean;
  /** Pine Valley: deer roam the meadows and can be hunted. */
  hunting: boolean;
  harvestStone: boolean;
  harvestOre: boolean;
  fishing: boolean;
  survivors: boolean;
  fireAcceptsWood: boolean;
  showResources: boolean;
  showMorale: boolean;
  wildlife: boolean;
  events: boolean;
}

export type EventKind = 'blizzard' | 'caravan' | 'scout';

export interface ActiveEvent {
  kind: EventKind;
  t: number;
  dur: number;
  ok: boolean;
}

export interface Caravan extends Mover {
  route: Vec[];
  state: 'arriving' | 'trading' | 'leaving';
  stop: Vec;
}

export interface Weather {
  windAngle: number;
  windStrength: number;
  gust: number;
  intensity: number;
  target: number;
}

export interface DayCycle {
  active: boolean;
  t: number;
  length: number;
  day: number;
}

export interface Kitchen {
  /** Raw fish waiting by the grill. */
  raw: number;
  /** Cook progress (0..1) of each grill slot; -1 = empty. */
  slots: number[];
  /** Cooked meals resting on the grill tray. */
  tray: number;
  /** Meals stocked on the serving counter. */
  counter: number;
  /** Cash bills waiting on the cash pad. */
  cash: number;
}

/** Chapter 2: salmon in, smoked fish out. */
export interface Smokehouse {
  raw: number;
  /** Smoking progress (0..1) per rack; -1 = empty. */
  slots: number[];
  /** Smoked fish crates ready to carry to the market. */
  ready: number;
}

export interface World {
  time: number;
  phase: number;
  stepIndex: number;
  stepStart: Stats;
  base: BaseLayout;
  player: Player;
  workers: Worker[];
  survivors: Survivor[];
  wolves: Wolf[];
  nodes: ResourceNode[];
  structures: Record<StructureId, Structure>;
  pads: Record<PadId, Pad>;
  towers: Tower[];
  traps: Trap[];
  doors: Record<string, GateDoor>;
  upgrades: Record<UpgradeId, boolean>;
  stock: Record<Carryable, number>;
  kitchen: Kitchen;
  coins: number;
  coinPile: number;
  /** Which level (map) this is: 1 = the Frozen Camp, 2 = Pine Valley. */
  worldId: 1 | 2;
  /** World 1 is finished: the travel card was shown once on its own. */
  /** The refuge is safe: the last chapter of this world was reached. */
  worldDone: boolean;
  /** The "find a new refuge or stay" card is showing. */
  refugeOffer: boolean;
  /** Pine Valley deer. */
  deer: Deer[];
  /** Items the player left in the stash (never money). */
  stash: Partial<Record<Carryable, number>>;
  /** Building the player tapped, shown in the info card for a few seconds. */
  info: { id: StructureId; at: number } | null;
  smoke: Smokehouse;
  /** Cash the market porter has earned, waiting on the market mat. */
  marketCash: number;
  fire: { lit: boolean; fuel: number; litAt: number };
  defense: Defense;
  stats: Stats;
  flags: Flags;
  morale: number;
  weather: Weather;
  day: DayCycle;
  event: ActiveEvent | null;
  eventCooldown: number;
  eventCount: number;
  caravan: Caravan | null;
  flare: Vec | null;
  wildSpawnT: number;
  survivorSpawnT: number;
  footprints: Footprint[];
  flyers: Flyer[];
  particles: Particle[];
  popups: Popup[];
  arrows: Arrow[];
  nextId: number;
  rng: () => number;
  /** Station levels (1 = as built). */
  levels: Record<StationId, number>;
  /** Camp level: XP from missions, meals and builds; each level pays a reward. */
  camp: { level: number; xp: number; next: number };
  /** Big centre-screen toast (mission complete / level up). */
  toast: { id: number; kind: 'mission' | 'level'; title: string; sub: string; at: number } | null;
  /** Tutorial memory: how far the player has walked (drag hint). */
  tutorial: { moved: number };
  /** Where the current objective wants the player to go (guide arrow). */
  guide: Vec | null;
  /** Show the tutorial hand at the guide target. */
  guideHand: boolean;
  /** Cues raised this frame (not saved). */
  sfx: Sfx[];
  /** Smoothed income in $/s while playing; drives the away-from-camp earnings. */
  incomeRate: number;
  gameOver: boolean;
  shake: number;
  hitstop: number;
  flash: number;
}
