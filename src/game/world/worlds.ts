import type { Vec } from '../core/types';
import { usePhases } from '../progression/phases';
import { SPOTS } from './layout';

/**
 * The game has more than one refuge ("world"). Each world shares the engine
 * and the stockade; what changes is the map around it, a few placements, the
 * missions, and how the food is drawn and named. Switching is done in place
 * (SPOTS and PHASES are mutated) so every system keeps reading the same
 * objects.
 */
export type WorldId = 1 | 2;

type SpotKey = keyof typeof SPOTS;
const FROST_SPOTS: Record<string, Vec> = Object.fromEntries(Object.entries(SPOTS).map(([k, v]) => [k, { ...v }]));

/** Pine Valley moves the hunter's hide out to the south meadow. */
const VALLEY_SPOTS: Partial<Record<SpotKey, Vec>> = {
  fisherSpot: { x: 13.7, y: 28.0 },
};

export const WORLD_INFO: Record<WorldId, { name: string; food: string; meal: string; foodIcon: string; mealIcon: string }> = {
  1: { name: 'Frostline Camp', food: 'Fish', meal: 'Meals', foodIcon: '🐟', mealIcon: '🍲' },
  2: { name: 'Pine Valley', food: 'Meat', meal: 'Skewers', foodIcon: '🥩', mealIcon: '🍢' },
};

let active: WorldId = 1;
export const activeWorld = (): WorldId => active;

export function activateWorld(id: WorldId): void {
  active = id;
  for (const [k, v] of Object.entries(FROST_SPOTS)) (SPOTS as Record<string, Vec>)[k] = { ...v };
  if (id === 2) for (const [k, v] of Object.entries(VALLEY_SPOTS)) (SPOTS as Record<string, Vec>)[k] = { ...v! };
  usePhases(id);
}
