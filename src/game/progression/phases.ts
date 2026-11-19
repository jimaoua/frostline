import { FIRE_WOOD_REQUIRED } from '../core/constants';
import { dist } from '../core/math';
import type { PadId, StationId, Stats, Vec, World } from '../core/types';
import { activatePad, buildStructure } from '../systems/build';
import { addXp, showToast } from '../systems/levels';
import { popup } from '../systems/effects';
import { clearWestYard } from '../systems/lake';
import { spawnStranded } from '../systems/settlement';
import { isMulti, padParts, padRatio } from '../systems/padcost';
import { CAVE, CAVE_MOUTH, SPOTS } from '../world/layout';
import { revealCave } from '../systems/cave';

/**
 * Strict, staged progression. Exactly one objective is live at a time, each
 * step introduces something NEW, and the step decides what the world reveals.
 * `target` drives the in-world guide arrow; `pad` lets the next purchase be
 * previewed as a locked pad so players always see what's coming.
 */
export interface StepDef {
  id: string;
  text: (w: World) => string;
  hint?: string;
  pad?: PadId;
  progress?: (w: World) => [number, number];
  target?: (w: World) => Vec | null;
  enter?: (w: World) => void;
  done: (w: World) => boolean;
  /** Cash paid out when the mission completes (default grows with the phase). */
  reward?: number;
  /** Show the tutorial hand on this step even after the opening. */
  hand?: boolean;
}

export interface PhaseDef {
  id: number;
  title: string;
  enter?: (w: World) => void;
  steps: StepDef[];
}

const since = (w: World, key: keyof Stats) => w.stats[key] - w.stepStart[key];
const carrying = (w: World, kind: string) => w.player.carry.filter((c) => c === kind).length;

function nearestTree(w: World): Vec | null {
  let best: Vec | null = null;
  let bd = Infinity;
  for (const n of w.nodes) {
    if (n.kind !== 'tree' || !n.interactive || n.amount <= 0 || n.elder) continue;
    const d = dist(n.pos, w.player.pos);
    if (d < bd) {
      bd = d;
      best = n.pos;
    }
  }
  return best;
}

/** Where to get a building material: its stockpile if workers filled it, else the nearest node. */
function materialSource(w: World, kind: string): Vec | null {
  if (w.structures.stash.built && (w.stash[kind as keyof World['stash']] ?? 0) > 0) return w.structures.stash.pos;
  if (kind === 'gold' || kind === 'diamond') return nearestNodeOf(w, kind);
  if (kind === 'wood') return w.stock.wood > 0 && w.structures.woodpile.built ? w.structures.woodpile.pos : nearestTree(w);
  const nodeKind = kind === 'stone' ? 'rock' : kind === 'ore' ? 'ore' : null;
  if (!nodeKind) return null;
  if (kind === 'stone' && w.stock.stone > 0 && w.structures.stonepile.built) return w.structures.stonepile.pos;
  let best: Vec | null = null;
  let bd = Infinity;
  for (const n of w.nodes) {
    if (n.kind !== nodeKind || !n.visible || n.amount <= 0) continue;
    const d = dist(n.pos, w.player.pos);
    if (d < bd) {
      bd = d;
      best = n.pos;
    }
  }
  return best;
}

/** Where cash is waiting, if anywhere. */
const cashTarget = (w: World): Vec | null =>
  w.kitchen.cash > 0
    ? w.structures.cashPad.pos
    : w.marketCash > 0 && w.structures.marketMat.built
      ? w.structures.marketMat.pos
      : w.coinPile > 0 && w.structures.tradeMat.built
        ? w.structures.tradeMat.pos
        : null;

/** The closest lake hole with fish in it (Chapter 2). */
function nearestIceHole(w: World): Vec | null {
  let best: Vec | null = null;
  let bd = Infinity;
  for (const n of w.nodes) {
    if (n.kind !== 'icehole' || n.amount <= 0) continue;
    const d = dist(n.pos, w.player.pos);
    if (d < bd) {
      bd = d;
      best = n.pos;
    }
  }
  return best;
}

/** Guide through the kitchen loop: fish → grill → hatch. */
function kitchenTarget(w: World): Vec {
  const k = w.kitchen;
  if (carrying(w, 'meal') > 0) return SPOTS.counterServe;
  if (carrying(w, 'fish') > 0 || k.tray > 0) return SPOTS.grillZone;
  return SPOTS.fishSpot;
}

const padStep = (id: PadId, text: string, hint?: string, enter?: (w: World) => void, target?: (w: World) => Vec | null): StepDef => ({
  id,
  pad: id,
  text: () => text,
  hint,
  progress: (w) => {
    const pad = w.pads[id];
    // Materials + money: one overall percentage; a single price: paid/total.
    return isMulti(pad) ? [Math.floor(padRatio(pad) * 100), 100] : [pad.paid, pad.cost.amount];
  },
  target: (w) => {
    const pad = w.pads[id];
    if (target) {
      const t = target(w);
      if (t) return t;
    }
    // Point at whatever is still missing: a material you are not carrying, then money.
    for (const part of padParts(pad)) {
      const left = part.amount - part.paid;
      if (left <= 0) continue;
      if (part.kind === 'coin') {
        if (w.coins < left) return cashTarget(w) ?? pad.pos;
      } else if (carrying(w, part.kind) === 0) {
        return materialSource(w, part.kind) ?? pad.pos;
      }
    }
    return pad.pos;
  },
  enter: (w) => {
    activatePad(w, id);
    enter?.(w);
  },
  done: (w) => w.pads[id].completed,
});

/** Buy a level of a station (Lv2 by default); its pad stays open for later levels. */
const levelStep = (id: PadId, station: StationId, text: string, hint: string, level = 2): StepDef => ({
  ...padStep(id, text, hint),
  id: level > 2 ? `${id}${level}` : id,
  progress: (w) => {
    if (w.levels[station] >= level) return [1, 1];
    const pad = w.pads[id];
    return isMulti(pad) ? [Math.floor(padRatio(pad) * 100), 100] : [pad.paid, pad.cost.amount];
  },
  done: (w) => w.levels[station] >= level,
});

const countStep = (
  id: string,
  text: string,
  key: keyof Stats,
  total: number,
  hint?: string,
  enter?: (w: World) => void,
  target?: (w: World) => Vec | null,
): StepDef => ({
  id,
  text: () => text,
  hint,
  enter,
  target,
  progress: (w) => [Math.min(total, since(w, key)), total],
  done: (w) => since(w, key) >= total,
});

export const PHASES: PhaseDef[] = [
  {
    id: 1,
    title: 'First Light',
    enter: (w) => {
      w.flags.harvestWood = true;
      w.flags.fireAcceptsWood = true;
    },
    steps: [
      {
        id: 'chop',
        text: () => 'Chop your first log',
        hint: 'Drag anywhere to move. Walk up to a tree to chop it.',
        reward: 5,
        progress: (w) => [Math.min(1, carrying(w, 'wood') + w.fire.fuel), 1],
        target: (w) => nearestTree(w),
        done: (w) => carrying(w, 'wood') + w.fire.fuel >= 1,
      },
      {
        id: 'ignite',
        text: () => `Bring ${FIRE_WOOD_REQUIRED} logs and light the campfire`,
        hint: 'Your logs stack on your back. Walk into the fire ring to drop them.',
        progress: (w) => [w.fire.fuel, FIRE_WOOD_REQUIRED],
        target: (w) =>
          carrying(w, 'wood') + w.fire.fuel >= FIRE_WOOD_REQUIRED || (carrying(w, 'wood') > 0 && w.base.isInside(w.player.pos.x, w.player.pos.y))
            ? w.structures.campfire.pos
            : nearestTree(w),
        done: (w) => w.fire.lit,
      },
    ],
  },
  {
    id: 2,
    title: 'Survivors',
    enter: (w) => {
      w.flags.fireAcceptsWood = false;
    },
    steps: [
      {
        id: 'rescue',
        text: () => 'Someone is freezing outside! Lead them to the fire',
        hint: 'Walk up to them. They will follow you home.',
        enter: spawnStranded,
        progress: (w) => [w.stats.rescued, 1],
        target: (w) => {
          const s = w.survivors.find((x) => x.state === 'stranded' || x.state === 'following');
          if (!s) return null;
          return s.state === 'stranded' ? s.pos : w.structures.campfire.pos;
        },
        done: (w) => w.stats.rescued >= 1,
      },
      countStep(
        'fish',
        'Catch 3 fish at the ice hole',
        'fishCaught',
        3,
        'Stand on the edge of the frozen pond.',
        (w) => {
          w.flags.fishing = true;
          buildStructure(w, 'fishPond');
        },
        () => SPOTS.fishSpot,
      ),
      padStep('grill', 'Build a grill with logs from the woodpile', 'Your lumberjack stacks logs at the woodpile. Grab them!', undefined, (w) =>
        carrying(w, 'wood') === 0 && w.stock.wood > 0 ? w.structures.woodpile.pos : carrying(w, 'wood') === 0 ? nearestTree(w) : null,
      ),
      countStep(
        'cook',
        'Grill your first fish',
        'mealsCooked',
        1,
        'Drop fish at the grill. It cooks by itself.',
        undefined,
        (w) => (carrying(w, 'fish') > 0 || w.kitchen.raw > 0 ? SPOTS.grillZone : SPOTS.fishSpot),
      ),
      countStep(
        'serve',
        'Cook fish and serve your first guests',
        'mealsServed',
        3,
        'Fish → grill → serving hatch. Hungry survivors pay cash.',
        (w) => {
          buildStructure(w, 'counter');
          buildStructure(w, 'cashPad');
          w.flags.survivors = true;
          w.survivorSpawnT = 0.5;
        },
        kitchenTarget,
      ),
      {
        id: 'cash',
        text: () => 'Scoop up your cash',
        hint: 'Guests pay on the green pad. Walk over it.',
        reward: 10,
        target: (w) => w.structures.cashPad.pos,
        progress: (w) => [Math.min(1, since(w, 'cashCollected')), 1],
        done: (w) => since(w, 'cashCollected') > 0 && w.kitchen.cash < 1,
      },
      { ...levelStep('upGrill', 'grill', 'Upgrade the grill to Lv 2', 'Every station can level up. A faster grill feeds more guests.'), hand: true },
      padStep(
        'fishShack',
        "Build a Fisher's Shack to automate the kitchen",
        'Scoop the cash off the green pad, then pay the shack.',
        undefined,
        (w) => (w.coins + w.kitchen.cash < w.pads.fishShack.cost.amount - w.pads.fishShack.paid && w.kitchen.cash === 0 ? kitchenTarget(w) : null),
      ),
    ],
  },
  {
    id: 3,
    title: 'Settlement',
    enter: (w) => {
      w.flags.showResources = true;
    },
    steps: [
      padStep('bonfire', 'Stoke the fire into a bonfire', 'A bigger fire draws more hungry survivors.'),
      levelStep('upHatch', 'hatch', 'Serve tastier meals', 'Each level makes every meal pay $4 more.'),
      padStep('lumberHut', 'Build the Lumberjack Hut', 'A second lumberjack doubles your wood.'),
      padStep('expandEast', 'Expand the stockade east', 'New land for trade and industry.'),
    ],
  },
  {
    id: 4,
    title: 'Trade & Stone',
    enter: (w) => {
      w.flags.harvestStone = true;
      for (const n of w.nodes) {
        if (n.kind === 'rock' && !n.visible) {
          n.visible = true;
          n.popT = 0.5 + w.rng() * 0.6;
        }
      }
    },
    steps: [
      padStep('tradingPost', 'Build the Trading Post', 'Logs from the woodpile pay for this. Sell your surplus on the mat.', undefined, (w) =>
        carrying(w, 'wood') === 0 && w.stock.wood > 0 ? w.structures.woodpile.pos : null,
      ),
      padStep('quarryCamp', 'Build the Quarry Camp', 'Rocks wait east of the new yard.'),
      levelStep('upLumber', 'lumber', 'Sharpen the lumber camp saws', 'Lumberjacks bring wood faster.'),
      levelStep('upFishing', 'fishing', 'Give the fishers better nets', 'Faster fishing keeps the grill busy.'),
      countStep('stone', 'Mine 8 stone', 'stoneGathered', 8, 'Swing your pick at the rocks outside the east gate.', undefined, (w) => {
        const r = w.nodes.filter((n) => n.kind === 'rock' && n.visible && n.amount > 0).sort((a, b) => dist(a.pos, w.player.pos) - dist(b.pos, w.player.pos))[0];
        return r ? r.pos : null;
      }),
    ],
  },
  {
    id: 5,
    title: 'Hold the Line',
    enter: (w) => {
      w.flags.showMorale = true;
    },
    steps: [
      padStep('expandNorth', 'Expand the stockade north', 'Room to grow before the wolves find you.'),
      padStep('tower1', 'Raise a Watchtower', 'Wolves are circling the camp.', (w) => {
        w.defense.visible = true;
      }),
      {
        id: 'wave1',
        text: () => 'Survive the first wolf pack',
        hint: 'Towers fire on their own. Stand near a wolf to swing at it.',
        enter: (w) => {
          w.defense.nextWaveIn = 10;
        },
        progress: (w) => [w.stats.wolvesKilled - w.stepStart.wolvesKilled, 3],
        target: (w) => w.wolves.find((x) => x.mode === 'raid')?.pos ?? null,
        done: (w) => w.defense.wavesCleared >= 1,
      },
      countStep(
        'ore',
        'Haul 3 iron ore back from the wilds',
        'oreSold',
        3,
        'Ore glints in clearings far outside. Predators roam there. Sell it at the trade mat.',
        (w) => {
          w.flags.wildlife = true;
          w.flags.harvestOre = true;
          w.flags.events = true;
          w.eventCooldown = 25;
          w.wildSpawnT = 1;
          for (const n of w.nodes) {
            if (n.kind === 'ore' && !n.visible) {
              n.visible = true;
              n.popT = 0.5;
            }
          }
        },
        (w) => {
          if (carrying(w, 'ore') >= 3 || (carrying(w, 'ore') > 0 && w.base.isInside(w.player.pos.x, w.player.pos.y))) return w.structures.tradeMat.pos;
          const o = w.nodes.filter((n) => n.kind === 'ore' && n.visible && n.amount > 0).sort((a, b) => dist(a.pos, w.player.pos) - dist(b.pos, w.player.pos))[0];
          return o ? o.pos : null;
        },
      ),
      padStep('tower2', 'Raise a second Watchtower'),
    ],
  },
  {
    id: 6,
    title: 'Frontier',
    steps: [
      padStep('workshop', 'Build the Workshop', 'Workshops unlock tools and upgrades.'),
      padStep('sharpAxes', 'Forge sharp axes', 'Faster chopping for everyone.', (w) => {
        activatePad(w, 'bigPacks');
        activatePad(w, 'ironArrows');
      }),
      padStep('shelter', 'Build a Shelter', 'Fed survivors may settle in for good.'),
      padStep('traps', 'Set traps at the gates'),
      padStep('gatehouse', 'Reinforce the gatehouse', 'Gates slam shut when raiders come.'),
    ],
  },
  {
    id: 7,
    title: 'The Frozen Lake',
    enter: (w) => {
      clearWestYard(w);
      popup(w, SPOTS.expandWest, 80, 'Chapter 2: The Frozen Lake', '#bfe6ff', true);
    },
    steps: [
      padStep('expandWest', 'Push the stockade west', 'Something glitters beyond the western trees.'),
      padStep('tower3', 'Raise a watchtower by the lake', 'The new west gate needs guarding: wolves cross the ice.'),
      padStep('smokehouse', 'Build the Smokehouse', 'Smoked salmon sells for a fortune.'),
      countStep('salmon', 'Catch 5 salmon through the ice', 'salmonCaught', 5, 'Stand by a hole in the lake ice to fish.', undefined, (w) =>
        carrying(w, 'salmon') >= 5 ? SPOTS.smokeDrop : nearestIceHole(w),
      ),
      countStep('smoke', 'Smoke 5 salmon', 'salmonSmoked', 5, 'Drop salmon at the Smokehouse, then wait for the racks.', undefined, (w) =>
        carrying(w, 'salmon') > 0 || w.smoke.raw > 0 || w.smoke.slots.some((x) => x >= 0) ? SPOTS.smokeDrop : nearestIceHole(w),
      ),
      padStep('market', 'Open the Fish Market'),
      countStep('sellSmoked', 'Sell 5 smoked fish', 'smokedSold', 5, 'Carry smoked fish to the market mat.', undefined, (w) =>
        carrying(w, 'smoked') > 0 ? w.structures.marketMat.pos : w.smoke.ready > 0 ? SPOTS.smokeDrop : carrying(w, 'salmon') > 0 ? SPOTS.smokeDrop : nearestIceHole(w),
      ),
      padStep('lakeCamp', "Build the Ice Fishers' Hut", 'Two ice fishers will keep the racks full.'),
      levelStep('upSmoke', 'smoke', 'Upgrade the Smokehouse', 'Faster racks, more fish to sell.'),
      levelStep('upStash', 'stash', 'Make room in the stash', 'Logs and cash buy a bigger stash by the stonepile.'),
    ],
  },
  {
    id: 8,
    title: 'The Glittering Cave',
    enter: (w) => {
      revealCave(w);
      popup(w, SPOTS.mineLodge, 80, 'Chapter 3: The Glittering Cave', '#ffe9a0', true);
    },
    steps: [
      {
        id: 'findCave',
        text: () => 'Follow the glint north of the camp',
        hint: 'Out through the north gate, to the foot of the mountain.',
        target: () => CAVE_MOUTH,
        done: (w) => dist(w.player.pos, CAVE) < 3.2,
      },
      padStep('mineLodge', "Build the Miners' Lodge", 'Lanterns and timber make the cave safe to work.'),
      countStep('gold', 'Mine 6 gold', 'goldMined', 6, 'Swing your pick at the gold veins in the cave.', undefined, (w) => nearestNodeOf(w, 'gold')),
      countStep('diamonds', 'Find 2 diamonds', 'diamondsMined', 2, 'The blue crystals hold diamonds.', undefined, (w) => nearestNodeOf(w, 'diamond')),
      levelStep('upGrill', 'grill', 'Gild the grill (Lv 3)', 'Gold buys the higher levels now.', 3),
      levelStep('upStash', 'stash', 'Turn the stash into a vault (Lv 3)', 'Stone and gold make the stash bigger.', 3),
      {
        id: 'endless',
        text: (w) => `Endure the frontier · Day ${w.day.day}`,
        hint: 'Keep the kitchen running, the fire burning and the walls standing.',
        done: () => false,
      },
    ],
  },
];

/** The nearest mineable node of a kind (gold or diamond veins in the cave). */
function nearestNodeOf(w: World, kind: 'gold' | 'diamond'): Vec | null {
  let best: Vec | null = null;
  let bd = Infinity;
  for (const n of w.nodes) {
    if (n.kind !== kind || !n.visible || n.amount <= 0) continue;
    const d = dist(n.pos, w.player.pos);
    if (d < bd) {
      bd = d;
      best = n.pos;
    }
  }
  return best;
}

function nextStep(w: World): StepDef | null {
  const phase = PHASES[w.phase - 1];
  if (w.stepIndex + 1 < phase.steps.length) return phase.steps[w.stepIndex + 1];
  return PHASES[w.phase]?.steps[0] ?? null;
}

function enterStep(w: World): void {
  w.stepStart = { ...w.stats };
  PHASES[w.phase - 1].steps[w.stepIndex].enter?.(w);
  // Preview the next purchase as a locked pad.
  for (const p of Object.values(w.pads)) p.locked = false;
  const next = nextStep(w);
  if (next?.pad && !w.pads[next.pad].active && !w.pads[next.pad].completed) {
    w.pads[next.pad].locked = true;
    w.pads[next.pad].activatedAt = w.time;
  }
}

export function startProgression(w: World): void {
  PHASES[0].enter?.(w);
  enterStep(w);
}

/**
 * Saves made before a chapter was added can point past the end of a phase
 * (e.g. the old Phase 6 "endless" step). Move them on to the next real step.
 */
export function migrateProgress(w: World): void {
  w.phase = Math.max(1, Math.min(PHASES.length, w.phase));
  let guard = 0;
  while (!PHASES[w.phase - 1].steps[w.stepIndex] && guard++ < 20) {
    if (w.phase >= PHASES.length) {
      w.stepIndex = PHASES[w.phase - 1].steps.length - 1;
      break;
    }
    w.phase++;
    w.stepIndex = 0;
    PHASES[w.phase - 1].enter?.(w);
    enterStep(w);
  }
}

export function updateProgression(w: World): void {
  migrateProgress(w);
  const phase = PHASES[w.phase - 1];
  const step = phase.steps[w.stepIndex];
  w.guide = step.target?.(w) ?? null;
  w.guideHand = w.phase <= 1 || (w.phase === 2 && w.stepIndex <= 3) || !!step.hand;
  if (!step.done(w)) return;
  if (step.id !== 'endless') {
    const reward = step.reward ?? 10 + w.phase * 5;
    w.coins += reward;
    w.stats.coinsEarned += reward;
    showToast(w, 'mission', 'Mission complete!', `+$${reward} · +20 XP`);
    addXp(w, 20);
  }
  w.stepIndex++;
  if (w.stepIndex >= phase.steps.length) {
    w.phase = Math.min(PHASES.length, w.phase + 1);
    w.stepIndex = 0;
    PHASES[w.phase - 1].enter?.(w);
  }
  enterStep(w);
}

export function currentObjective(w: World) {
  const phase = PHASES[w.phase - 1];
  const step = phase.steps[w.stepIndex];
  return {
    phase: phase.id,
    phaseTitle: phase.title,
    stepIndex: w.stepIndex,
    stepId: step.id,
    stepCount: phase.steps.length,
    text: step.text(w),
    hint: step.hint,
    progress: step.progress?.(w),
  };
}
