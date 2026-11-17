import type { Pad, World } from './core/types';
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
  resources?: { coins: number; wood: number; stone: number };
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
    resources: w.flags.showResources ? { coins: Math.floor(w.coins), wood: w.stock.wood, stone: w.stock.stone } : undefined,
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
