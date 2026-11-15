import { storage } from '../platform/storage';
import type { World } from './core/types';
import { createWorld } from './world/createWorld';

/**
 * Save games. The whole world is plain data except a few things that are
 * rebuilt instead of stored: the random generator, the stockade layout (rebuilt
 * from the unlocked areas), and short-lived effects (particles, flying items,
 * popups, arrows, footprints, sound cues).
 */

const KEY = 'frostline.save.v1';
const VERSION = 1;

/** World keys that are rebuilt or transient, never stored. */
const SKIP = new Set<keyof World>(['rng', 'base', 'flyers', 'particles', 'popups', 'arrows', 'footprints', 'sfx', 'toast']);

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
    Object.assign(w, file.world);
    for (const q of file.unlocked) w.base.unlock(q as Parameters<World['base']['unlock']>[0]);
    // Guard fields added after a save was written.
    w.sfx = [];
    w.toast = null;
    w.incomeRate = Number.isFinite(w.incomeRate) ? w.incomeRate : 0;
    w.hitstop = 0;
    w.shake = 0;
    w.flash = 0;
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
