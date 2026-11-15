// Isometric tile size in world-pixels (2:1 diamond).
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

// Playable map, in tiles.
export const MAP_SIZE = 44;
export const MAP_MIN = 1;
export const MAP_MAX = MAP_SIZE - 1;
export const BASE_CENTER = { x: 22, y: 18 };

// Movement (tiles / second).
export const PLAYER_SPEED = 3.4;
export const PLAYER_RADIUS = 0.26;
export const PLAYER_CAPACITY = 12;
export const PLAYER_HP = 100;
export const WORKER_SPEED = 2.3;
export const HAULER_SPEED = 2.6;
export const WOLF_SPEED = 1.75;
export const BEAR_SPEED = 1.45;

// Snow trails.
export const FOOTPRINT_STEP = 0.32;
export const FOOTPRINT_LIFE = 8;
export const MAX_FOOTPRINTS = 700;

// Economy.
export const FIRE_WOOD_REQUIRED = 6;
export const SELL_PRICE = { wood: 2, stone: 4, ore: 12, fish: 2, meal: 6, salmon: 4, smoked: 18 } as const;

// Chapter 2: the frozen lake.
export const SMOKE_TIME = 3.2;
export const SMOKE_SLOTS = 2;
export const MEAL_PRICE = 10;
export const COOK_TIME = 1.7;
export const GRILL_SLOTS = 3;
export const FISH_INTERVAL = 0.85;
export const MAX_QUEUE = 6;
export const BOUNTY = { wolf: 5, bear: 25 } as const;

// Resource nodes.
export const NODE_AMOUNT = { tree: 4, rock: 5, ore: 3, icehole: 3 } as const;
export const ELDER_WOOD = 8;
export const REGROW = { tree: 22, rock: 30, ore: 45, icehole: 16 } as const;

// Defense.
export const WAVE_INTERVAL = 75;
export const TOWER_RANGE = 6.5;
export const TOWER_COOLDOWN = 0.7;
export const TOWER_DAMAGE = 2;
export const DOOR_HP = 24;

// Survival.
export const FIRE_WARM_RADIUS = 2.6;
export const DAY_LENGTH = 180;
export const MORALE_START = 70;
