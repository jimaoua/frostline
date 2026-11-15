import { storage } from './storage';

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
}

const KEY = 'frostline.settings.v1';
const DEFAULTS: Settings = { sound: true, music: true, haptics: true };

function load(): Settings {
  try {
    const raw = storage.get(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Player preferences, persisted separately from the save game. */
export const settings: Settings = load();

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  storage.set(KEY, JSON.stringify(settings));
}
