import { audio } from '../platform/audio';
import { haptic, type HapticKind } from '../platform/haptics';
import { setSetting, settings, type Settings } from '../platform/settings';
import { WAVE_INTERVAL } from './core/constants';
import type { Sfx, World } from './core/types';
import { deleteSave, hasSave, loadWorld, saveWorld } from './save';
import { updateLevelPads } from './systems/levels';
import { updateSmokehouse } from './systems/lake';
import { buildHud, type HudSnapshot } from './hud';
import { Input } from './input/input';
import { startProgression, updateProgression } from './progression/phases';
import { Renderer } from './render/renderer';
import { updateDefense } from './systems/defense';
import { burst, popup, updateEffects } from './systems/effects';
import { updateEvents, updateWeather } from './systems/events';
import { settlePaidPads, updatePlayerInteractions } from './systems/interact';
import { updatePlayer } from './systems/player';
import { updateKitchen, updateMorale, updateSurvivors } from './systems/settlement';
import { updateWildlife } from './systems/wildlife';
import { updateWorkers } from './systems/workers';
import { createWorld } from './world/createWorld';

const HUD_INTERVAL = 0.12;
const AUTOSAVE_EVERY = 8;
/** Share of cash lost when the fire goes out (the camp itself is kept). */
const RELIGHT_COST = 0.25;
/** Away earnings: 10% of the recent income rate, for up to 4 hours away. */
const AWAY_SHARE = 0.1;
const AWAY_CAP_S = 4 * 3600;
const AWAY_MIN_S = 60;

export type AppMode = 'menu' | 'welcome' | 'playing' | 'paused';

export interface AppState {
  mode: AppMode;
  hasSave: boolean;
  settings: Settings;
  welcome: { amount: number; away: string } | null;
}

export type GameSnapshot = HudSnapshot & { app: AppState };

/**
 * Haptics for game events. Every item that lands on a stack gives a tiny
 * tick (the "pile it up" feel); hits and catches thump; builds and level-ups
 * pulse.
 */
const HAPTIC: Partial<Record<Sfx, HapticKind>> = {
  land_wood: 'tick',
  land_stone: 'tick',
  land_ore: 'tick',
  land_fish: 'tick',
  land_meal: 'tick',
  land_coin: 'tick',
  land_salmon: 'tick',
  land_smoked: 'tick',
  chop: 'medium',
  mine: 'medium',
  catch: 'medium',
  hit: 'medium',
  cooked: 'light',
  day: 'light',
  mission: 'success',
  build: 'success',
  upgrade: 'success',
  levelup: 'success',
  fire: 'heavy',
  hurt: 'warning',
  drop: 'heavy',
  howl: 'medium',
  stage: 'medium',
  full: 'light',
};

/**
 * Money moves in fast streams of bills; a tick on every bill turns into a
 * buzz, so only every third one is felt (sound and motion carry the rest).
 */
const HAPTIC_EVERY: Partial<Record<Sfx, number>> = { land_coin: 3 };

/**
 * Framework-agnostic game host. React only mounts it and subscribes to the
 * HUD snapshot; the simulation and the canvas never go through React.
 */
export class Game {
  private world: World;
  private renderer: Renderer;
  private input: Input;
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private snapshot: GameSnapshot;
  private snapshotKey = '';
  private mode: AppMode = 'menu';
  private welcome: { amount: number; away: string } | null = null;
  private saveTimer = AUTOSAVE_EVERY;
  private prevCoins = 0;
  private hiddenAt = 0;
  private hapticCount = new Map<Sfx, number>();
  private listeners = new Set<() => void>();
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    const loaded = loadWorld();
    this.world = loaded?.world ?? this.freshWorld();
    if (loaded) {
      settlePaidPads(this.world);
      this.offerAwayEarnings(loaded.awaySeconds);
    }
    this.prevCoins = this.world.coins;
    this.renderer = new Renderer(canvas);
    this.input = new Input(container);
    this.snapshot = this.makeSnapshot();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.persist);
    this.resizeObserver = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      this.renderer.resize(r.width, r.height);
    });
    this.resizeObserver.observe(container);
    const r = container.getBoundingClientRect();
    this.renderer.resize(r.width, r.height);
  }

  start(): void {
    this.last = performance.now();
    this.renderer.snapCamera(this.world);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    this.persist();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.persist);
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.resizeObserver.disconnect();
    this.listeners.clear();
  }

  reset(): void {
    this.world = this.freshWorld();
    this.prevCoins = 0;
    this.renderer.snapCamera(this.world);
    this.persist();
    this.publish();
  }

  /**
   * The fire went out: instead of wiping the camp (harsh on mobile), the
   * survivors relight it. The raid is driven off, and the cost is a share of
   * the cash and some morale.
   */
  relight(): void {
    const w = this.world;
    if (!w.gameOver) return;
    const lost = Math.floor(w.coins * RELIGHT_COST);
    w.coins -= lost;
    w.gameOver = false;
    w.wolves = w.wolves.filter((x) => x.mode !== 'raid');
    w.defense.waveActive = false;
    w.defense.health = Math.round(w.defense.maxHealth * 0.6);
    w.defense.nextWaveIn = WAVE_INTERVAL;
    w.morale = Math.max(0, w.morale - 15);
    w.shake = 0.4;
    const c = w.structures.campfire.pos;
    burst(w, 'spark', c, 30, { color: ['#ffb02e', '#ffd34d', '#ff7a1f'], z: 14, speed: 1.8, up: 160, size: 2.4, life: 1 });
    popup(w, c, 70, lost > 0 ? `Fire relit · -$${lost}` : 'Fire relit', '#ffcf7a', true);
    w.sfx.push('fire');
    this.prevCoins = w.coins;
    this.persist();
    this.publish();
  }

  // --- App flow (menus are React; these are the commands they call) -----

  /** Play / Continue from the main menu. Runs inside the tap, so audio can unlock. */
  play(): void {
    audio.unlock();
    this.mode = this.welcome ? 'welcome' : 'playing';
    this.input.clear();
    this.publish();
  }

  newGame(): void {
    audio.unlock();
    deleteSave();
    this.welcome = null;
    this.reset();
    this.mode = 'playing';
    this.publish();
  }

  collectWelcome(): void {
    if (this.welcome) {
      const amount = this.welcome.amount;
      this.world.coins += amount;
      this.world.stats.coinsEarned += amount;
      this.prevCoins = this.world.coins;
      audio.play('levelup');
      haptic('success');
    }
    this.welcome = null;
    this.mode = 'playing';
    this.persist();
    this.publish();
  }

  pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.clear();
    this.persist();
    this.publish();
  }

  resume(): void {
    audio.unlock();
    this.mode = this.welcome ? 'welcome' : 'playing';
    this.input.clear();
    this.publish();
  }

  toMenu(): void {
    this.persist();
    this.mode = 'menu';
    this.publish();
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setSetting(key, value);
    audio.applySettings();
    if (key === 'haptics' && value) haptic('medium');
    this.publish();
  }

  /** Save now (also runs on autosave, pause, background and page close). */
  persist = () => {
    if (!this.world.gameOver) saveWorld(this.world);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.hiddenAt = Date.now();
      this.persist();
      audio.suspend();
      if (this.mode === 'playing') this.mode = 'paused';
      this.publish();
    } else {
      audio.resume();
      this.last = performance.now();
      if (this.hiddenAt) this.offerAwayEarnings((Date.now() - this.hiddenAt) / 1000);
      this.hiddenAt = 0;
      this.publish();
    }
  };

  private offerAwayEarnings(seconds: number): void {
    const w = this.world;
    if (seconds < AWAY_MIN_S || !w.workers.length || w.gameOver) return;
    const amount = Math.round(Math.min(seconds, AWAY_CAP_S) * w.incomeRate * AWAY_SHARE);
    if (amount < 5) return;
    const prev = this.welcome?.amount ?? 0;
    this.welcome = { amount: prev + amount, away: formatAway(seconds) };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  /** Exposed for debugging and automated tests. */
  get debugWorld(): World {
    return this.world;
  }

  /** Advance the simulation deterministically (tests / debugging). */
  step(dt: number, dir = { x: 0, y: 0 }): void {
    this.update(dt, dir);
  }

  private freshWorld(): World {
    const w = createWorld();
    startProgression(w);
    return w;
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const running = this.mode === 'playing' && !this.world.gameOver;
    // A tap on a building shows what it is; a tap on empty ground closes it.
    const tap = this.input.takeTap();
    if (tap && this.mode === 'playing') {
      const id = this.renderer.pickStructure(this.world, tap.x, tap.y);
      this.world.info = id ? { id, at: this.world.time } : null;
      if (id) {
        this.world.structures[id].bumpAt = this.world.time;
        haptic('light');
      }
      this.publish();
    }
    if (running) {
      this.update(dt, this.input.worldDirection());
      this.trackIncome(dt);
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) {
        this.saveTimer = AUTOSAVE_EVERY;
        this.persist();
      }
    }
    this.playCues();
    this.renderer.render(this.world, this.input, running ? dt : 0);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = HUD_INTERVAL;
      this.publish();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number, dir: { x: number; y: number }): void {
    const w = this.world;
    // Hit-stop: freeze the simulation for a few frames on big impacts.
    if (w.hitstop > 0) {
      w.hitstop -= dt;
      return;
    }
    w.time += dt;
    updateWeather(w, dt);
    updatePlayer(w, dir, dt);
    w.tutorial.moved += Math.hypot(w.player.vel.x, w.player.vel.y) * dt;
    updateLevelPads(w);
    updatePlayerInteractions(w, dt);
    updateKitchen(w, dt);
    updateSmokehouse(w, dt);
    updateWorkers(w, dt);
    updateSurvivors(w, dt);
    updateDefense(w, dt);
    updateWildlife(w, dt);
    updateEvents(w, dt);
    updateMorale(w, dt);
    updateEffects(w, dt);
    updateProgression(w);
  }

  /** Smoothed $/s over the last ~2 minutes of play (only money coming in). */
  private trackIncome(dt: number): void {
    const w = this.world;
    const gained = Math.max(0, w.coins - this.prevCoins);
    this.prevCoins = w.coins;
    if (dt > 0) w.incomeRate += (gained / dt - w.incomeRate) * Math.min(1, dt / 120);
  }

  private playCues(): void {
    const q = this.world.sfx;
    if (!q.length) return;
    for (const id of q) {
      audio.play(id);
      const h = HAPTIC[id];
      if (!h) continue;
      const every = HAPTIC_EVERY[id];
      if (every) {
        const n = (this.hapticCount.get(id) ?? 0) + 1;
        this.hapticCount.set(id, n);
        if (n % every !== 1) continue;
      }
      haptic(h);
    }
    q.length = 0;
  }

  private makeSnapshot(): GameSnapshot {
    return {
      ...buildHud(this.world),
      app: { mode: this.mode, hasSave: hasSave(), settings: { ...settings }, welcome: this.welcome },
    };
  }

  private publish(): void {
    const next = this.makeSnapshot();
    const key = JSON.stringify(next);
    if (key === this.snapshotKey) return;
    this.snapshotKey = key;
    this.snapshot = next;
    this.listeners.forEach((fn) => fn());
  }
}

function formatAway(s: number): string {
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h >= 4 ? '4+ hours' : m ? `${h} h ${m} min` : `${h} h`;
}
