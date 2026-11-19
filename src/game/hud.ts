import type { Carryable, ItemKind, Pad, World } from './core/types';
import { BUILDING_INFO } from './world/buildingInfo';
import { isMulti } from './systems/padcost';
import { currentObjective } from './progression/phases';
import { EVENT_INFO } from './systems/events';
import { residents } from './systems/settlement';

/** Everything the React HUD is allowed to know. Built at ~8 Hz, not per frame. */
export interface HudSnapshot {
  phase: number;
  phaseTitle: string;
  stepIndex: number;
  stepId: string;
  stepCount: number;
  objective: string;
  hint?: string;
  progress?: { value: number; total: number; percent?: boolean };
  /** Money, and what the player is carrying right now (by kind). */
  resources?: { coins: number; carry: { kind: Carryable; n: number }[] };
  /** What sits in the stash, and what the workers have stockpiled. */
  storage?: { stash: { kind: Carryable; n: number }[]; workers: { id: string; label: string; kind: ItemKind; n: number }[] };
  info?: { id: string; title: string; text: string };
  morale?: { value: number; residents: number };
  defense?: { health: number; maxHealth: number; wave: number; nextWaveIn: number | null; wolves: number };
  vitals?: { hp: number; maxHp: number; warmth: number | null };
  event?: { kind: string; title: string; text: string; remaining: number; ratio: number };
  day?: { day: number; night: boolean };
  camp?: { level: number; xp: number; next: number };
  toast?: { id: number; kind: 'mission' | 'level'; title: string; sub: string };
  dragHint: boolean;
  gameOver: boolean;
}

export function buildHud(w: World): HudSnapshot {
  const o = currentObjective(w);
  const p = w.player;
  const outside = !w.base.isInside(p.pos.x, p.pos.y);
  const blizzard = w.event?.kind === 'blizzard';
  const showVitals = w.flags.wildlife && (outside || p.hp < p.maxHp - 1 || blizzard);
  const t = w.day.t / w.day.length;
  return {
    phase: o.phase,
    phaseTitle: o.phaseTitle,
    stepIndex: o.stepIndex,
    stepId: o.stepId,
    stepCount: o.stepCount,
    objective: o.text,
    hint: o.hint,
    progress: o.progress
      ? { value: Math.floor(o.progress[0]), total: o.progress[1], percent: isMultiStep(w, o.stepId) }
      : undefined,
    resources: w.flags.showResources ? { coins: Math.floor(w.coins), carry: carried(w) } : undefined,
    storage: w.flags.showResources ? storage(w) : undefined,
    info: w.info && w.time - w.info.at < INFO_SECONDS ? { id: w.info.id, ...BUILDING_INFO[w.info.id] } : undefined,
    morale: w.flags.showMorale ? { value: Math.round(w.morale), residents: residents(w) } : undefined,
    defense: w.defense.visible
      ? {
          health: Math.ceil(w.defense.health),
          maxHealth: w.defense.maxHealth,
          wave: w.defense.wave,
          nextWaveIn: w.defense.nextWaveIn === null ? null : Math.ceil(w.defense.nextWaveIn),
          wolves: w.wolves.filter((x) => x.mode === 'raid').length,
        }
      : undefined,
    vitals: showVitals || blizzard ? { hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp, warmth: blizzard ? Math.round(p.warmth) : null } : undefined,
    event: w.event
      ? {
          kind: w.event.kind,
          ...EVENT_INFO[w.event.kind],
          remaining: Math.ceil(w.event.dur - w.event.t),
          ratio: Math.max(0, 1 - w.event.t / w.event.dur),
        }
      : undefined,
    day: w.day.active && w.phase >= 3 ? { day: w.day.day, night: t > 0.62 && t < 0.95 } : undefined,
    camp: w.fire.lit ? { level: w.camp.level, xp: Math.floor(w.camp.xp), next: w.camp.next } : undefined,
    toast: w.toast && w.time - w.toast.at < 2.4 ? { id: w.toast.id, kind: w.toast.kind, title: w.toast.title, sub: w.toast.sub } : undefined,
    dragHint: w.phase === 1 && w.tutorial.moved < 1.5,
    gameOver: w.gameOver,
  };
}

/** Pads that take several materials report one overall percentage. */
function isMultiStep(w: World, stepId: string): boolean {
  const pad = (w.pads as Record<string, Pad | undefined>)[stepId];
  return !!pad && isMulti(pad);
}

const INFO_SECONDS = 5;
const KINDS: Carryable[] = ['wood', 'stone', 'ore', 'fish', 'meal', 'salmon', 'smoked'];

/** Counts in the player's arms: logs and stone always, the rest only when carried. */
function carried(w: World): { kind: Carryable; n: number }[] {
  const out: { kind: Carryable; n: number }[] = [];
  for (const kind of KINDS) {
    const n = w.player.carry.filter((c) => c === kind).length;
    if (n > 0 || kind === 'wood' || kind === 'stone') out.push({ kind, n });
  }
  return out;
}

function storage(w: World): NonNullable<HudSnapshot['storage']> {
  const S = w.structures;
  const stash = KINDS.map((kind) => ({ kind, n: w.stash[kind] ?? 0 })).filter((x) => x.n > 0);
  const workers: NonNullable<HudSnapshot['storage']>['workers'] = [];
  const add = (on: boolean, id: string, label: string, kind: ItemKind, n: number) => {
    if (on) workers.push({ id, label, kind, n: Math.floor(n) });
  };
  add(S.woodpile.built, 'woodpile', 'Woodpile', 'wood', w.stock.wood);
  add(S.stonepile.built, 'stonepile', 'Stonepile', 'stone', w.stock.stone);
  add(S.grill.built, 'tray', 'Grill tray', 'meal', w.kitchen.tray);
  add(S.counter.built, 'counter', 'Counter', 'meal', w.kitchen.counter);
  add(S.cashPad.built, 'cash', 'Cash pad', 'coin', w.kitchen.cash);
  add(S.tradeMat.built, 'trade', 'Trade mat', 'coin', w.coinPile);
  add(S.smokehouse.built, 'smoked', 'Smokehouse', 'smoked', w.smoke.ready);
  add(S.marketMat.built, 'market', 'Market mat', 'coin', w.marketCash);
  return { stash, workers };
}
