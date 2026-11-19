import { storage } from '../platform/storage';
import type { World } from './core/types';
import { PLAYER_CAPACITY } from './core/constants';
import { migrateProgress } from './progression/phases';
import { buildCostFor, createWorld } from './world/createWorld';
import type { PadId } from './core/types';

/**
 * Save games. The whole world is plain data except a few things that are
 * rebuilt instead of stored: the random generator, the stockade layout (rebuilt
 * from the unlocked areas), and short-lived effects (particles, flying items,
 * popups, arrows, footprints, sound cues).
 */

const KEY = 'frostline.save.v1';
const VERSION = 1;

/** World keys that are rebuilt or transient, never stored. */
const SKIP = new Set<keyof World>(['rng', 'base', 'flyers', 'particles', 'popups', 'arrows', 'footprints', 'sfx', 'toast', 'info']);

interface SaveFile {
  version: number;
  savedAt: number;
  unlocked: string[];
  world: Partial<World>;
}

export function saveWorld(w: World): boolean {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(w) as (keyof World)[]) {
    if (!SKIP.has(k)) data[k] = w[k];
  }
  const file: SaveFile = {
    version: VERSION,
    savedAt: Date.now(),
    unlocked: [...w.base.unlocked],
    world: data as Partial<World>,
  };
  try {
    return storage.set(KEY, JSON.stringify(file));
  } catch {
    return false;
  }
}

export interface LoadedSave {
  world: World;
  /** Real-world seconds since the save was written. */
  awaySeconds: number;
}

export function loadWorld(): LoadedSave | null {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    const file = JSON.parse(raw) as SaveFile;
    if (file.version !== VERSION || !file.world) return null;
    // Start from a fresh world (generator, layout, empty effects), then lay the saved state over it.
    const w = createWorld(Date.now() % 100000);
    // Lay the save over the fresh world. Records (structures, pads, stats,
    // levels, flags, stock…) are merged so content added in later versions
    // (e.g. Chapter 2 buildings) is present in old saves too.
    const fresh = w as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(file.world as Record<string, unknown>)) {
      const cur = fresh[k];
      fresh[k] = isRecord(cur) && isRecord(v) ? { ...cur, ...v } : v;
    }
    for (const q of file.unlocked) w.base.unlock(q as Parameters<World['base']['unlock']>[0]);
    // Guard fields added after a save was written.
    w.sfx = [];
    w.toast = null;
    w.incomeRate = Number.isFinite(w.incomeRate) ? w.incomeRate : 0;
    w.hitstop = 0;
    w.shake = 0;
    w.flash = 0;
    // Packs doubled in size (v1.3): give older saves the bigger pack too.
    const lv = Math.min(w.camp?.level ?? 1, 12);
    const expected = PLAYER_CAPACITY + (w.upgrades.bigPacks ? 12 : 0) + 4 * Math.floor(lv / 3);
    w.player.capacity = Math.max(w.player.capacity, expected);
    migratePadCosts(w);
    migrateProgress(w);
    return { world: w, awaySeconds: Math.max(0, (Date.now() - file.savedAt) / 1000) };
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return storage.get(KEY) !== null;
}

export function deleteSave(): void {
  storage.remove(KEY);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Stage 3 moved most building prices to materials + money. A pad an old save
 * has not started gets the new price; a pad already part-paid keeps the price
 * it was being paid in, so nothing anyone handed over is lost.
 */
function migratePadCosts(w: World): void {
  for (const id of Object.keys(w.pads) as PadId[]) {
    const pad = w.pads[id];
    const next = buildCostFor(id);
    if (!next || pad.completed) continue;
    const started = pad.paid > 0 || (pad.parts ?? []).some((p) => p.paid > 0);
    if (started) continue;
    pad.cost = next.cost;
    pad.parts = next.parts;
  }
}
