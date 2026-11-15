import { useSyncExternalStore } from 'react';
import type { Game, GameSnapshot } from '../game/Game';

export function useHud(game: Game): GameSnapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
}
