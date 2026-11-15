import {
  BEAR_SPEED,
  BOUNTY,
  MAP_MAX,
  MAP_MIN,
  TOWER_COOLDOWN,
  TOWER_DAMAGE,
  TOWER_RANGE,
  WAVE_INTERVAL,
  WOLF_SPEED,
} from '../core/constants';
import { addXp } from './levels';
import { worldVecToScreenAngle } from '../core/iso';
import { clamp, dist } from '../core/math';
import type { Species, Vec, Wolf, World } from '../core/types';
import { addFlyer, burst, popup, ring, sfx } from './effects';
import { earn } from './interact';
import { brake, followRoute, makeMover, updateMotion } from './motion';
import { planRoute } from './routing';

const TOWER_TOP_Z = 74;

export function makePredator(w: World, species: Species, pos: Vec, mode: 'raid' | 'roam', hpBonus = 0): Wolf {
  const bear = species === 'bear';
  const hp = (bear ? 14 : 4) + hpBonus;
  return {
    ...makeMover(pos, (bear ? BEAR_SPEED : WOLF_SPEED) * (0.9 + w.rng() * 0.2)),
    id: w.nextId++,
    species,
    mode,
    hp,
    maxHp: hp,
    route: [],
    attackT: 0.5 + w.rng() * 0.5,
    hurtT: 0,
    lunge: 0,
    stunT: 0,
    home: { ...pos },
    chasing: false,
    wanderT: 0,
  };
}

function spawnWave(w: World): void {
  const d = w.defense;
  d.wave++;
  sfx(w, 'howl');
  d.waveActive = true;
  const fire = w.structures.campfire.pos;
  const count = 1 + d.wave * 2;
  const side = w.rng() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = side + (w.rng() - 0.5) * 1.4;
    const r = 16 + w.rng() * 3;
    const pos = {
      x: clamp(fire.x + Math.cos(a) * r, MAP_MIN + 0.5, MAP_MAX - 0.5),
      y: clamp(fire.y + Math.sin(a) * r, MAP_MIN + 0.5, MAP_MAX - 0.5),
    };
    const bear = d.wave >= 3 && i === 0;
    const ringA = w.rng() * Math.PI * 2;
    const target = { x: fire.x + Math.cos(ringA) * 1.15, y: fire.y + Math.sin(ringA) * 1.15 };
    const wolf = makePredator(w, bear ? 'bear' : 'wolf', pos, 'raid', d.wave - 1);
    wolf.route = planRoute(w.base, pos, target);
    w.wolves.push(wolf);
  }
}

export function damageWolf(w: World, wolf: Wolf, dmg: number): void {
  if (wolf.hp <= 0) return;
  wolf.hp -= dmg;
  wolf.hurtT = 0.18;
  sfx(w, 'hit');
  popup(w, wolf.pos, wolf.species === 'bear' ? 52 : 34, `${Math.round(dmg * 10) / 10}`, '#ffb1a6');
  if (wolf.hp > 0) return;
  const bear = wolf.species === 'bear';
  burst(w, 'puff', wolf.pos, bear ? 18 : 10, { color: '#e9eef4', z: 10, speed: 1.4, up: 30, size: bear ? 11 : 8, life: 0.7 });
  ring(w, wolf.pos, bear ? 1.8 : 1.1, '#ffffff', 0.4);
  w.stats.wolvesKilled++;
  addXp(w, 3);
  w.hitstop = Math.max(w.hitstop, bear ? 0.12 : 0.045);
  w.shake = Math.max(w.shake, bear ? 0.4 : 0.15);
  const bounty = BOUNTY[wolf.species];
  for (let i = 0; i < (bear ? 4 : 1); i++) {
    addFlyer(w, 'coin', wolf.pos, 16, () => w.player.pos, 40, 0.45 + i * 0.08, 40, () => earn(w, bounty / (bear ? 4 : 1)));
  }
  popup(w, wolf.pos, 60, `+$${bounty}`, '#9cf5a8', bear);
}

function gateBlocking(w: World, wolf: Wolf): string | null {
  if (!w.upgrades.gatehouse || wolf.mode !== 'raid' || !wolf.route.length) return null;
  for (const g of w.base.gates) {
    const door = w.doors[g.id];
    if (!door || door.hp <= 0) continue;
    if (dist(wolf.route[0], g.inPoint) < 0.01 && dist(wolf.pos, g.outPoint) < 0.75) return g.id;
  }
  return null;
}

export function updateDefense(w: World, dt: number): void {
  const d = w.defense;
  const fire = w.structures.campfire.pos;

  if (d.visible && d.nextWaveIn !== null && w.event?.kind !== 'blizzard') {
    d.nextWaveIn -= dt;
    if (d.nextWaveIn <= 0) {
      d.nextWaveIn = null;
      spawnWave(w);
    }
  }

  // Raiders.
  for (const wolf of w.wolves) {
    if (wolf.mode !== 'raid') continue;
    wolf.hurtT = Math.max(0, wolf.hurtT - dt);
    wolf.lunge = Math.max(0, wolf.lunge - dt * 4);
    wolf.lookAt = null;
    const big = wolf.species === 'bear';
    if (wolf.stunT > 0) {
      wolf.stunT -= dt;
      brake(wolf, dt);
    } else {
      const blockGate = gateBlocking(w, wolf);
      if (blockGate) {
        brake(wolf, dt);
        const door = w.doors[blockGate];
        const g = w.base.gates.find((x) => x.id === blockGate)!;
        wolf.lookAt = g.inPoint;
        wolf.attackT -= dt;
        if (wolf.attackT <= 0) {
          wolf.attackT = 0.8;
          wolf.lunge = 1;
          door.hp -= big ? 6 : 2;
          door.hitAt = w.time;
          burst(w, 'chip', g.inPoint, 3, { color: '#a8693c', z: 16, speed: 1, up: 80, size: 2.5, life: 0.6 });
          if (door.hp <= 0) {
            popup(w, g.outPoint, 50, 'Gate broken!', '#ff8b7a', true);
            w.shake = 0.3;
          }
        }
      } else if (followRoute(wolf, dt)) {
        brake(wolf, dt);
        wolf.lookAt = fire;
        wolf.attackT -= dt;
        if (wolf.attackT <= 0) {
          wolf.attackT = 0.8;
          wolf.lunge = 1;
          d.health = Math.max(0, d.health - (big ? 9 : 4));
          w.shake = Math.max(w.shake, 0.12);
          burst(w, 'spark', fire, 3, { color: '#ff7a3d', z: 16, speed: 1, up: 70, size: 2, life: 0.5 });
        }
      }
    }
    updateMotion(wolf, dt, w, { paw: true, big });
  }

  // Doors swing shut when raiders are close.
  for (const g of w.base.gates) {
    const door = w.doors[g.id];
    if (!door) continue;
    const danger = w.wolves.some((x) => (x.mode === 'raid' || x.chasing) && dist(x.pos, g.outPoint) < 5);
    const shut = danger && door.hp > 0;
    door.open += ((shut ? 0 : 1) - door.open) * Math.min(1, dt * 6);
  }

  // Traps outside the gates.
  for (const t of w.traps) {
    if (!t.armed) {
      t.rearmT -= dt;
      if (t.rearmT <= 0) t.armed = true;
      continue;
    }
    const prey = w.wolves.find((x) => x.hp > 0 && dist(x.pos, t.pos) < 0.45);
    if (!prey) continue;
    t.armed = false;
    t.rearmT = 6;
    t.snapAt = w.time;
    prey.stunT = 1.6;
    damageWolf(w, prey, prey.species === 'bear' ? 6 : 4);
    burst(w, 'spark', t.pos, 6, { color: '#e8eef4', z: 6, speed: 1, up: 70, size: 1.8, life: 0.4 });
  }

  // Player swings at anything close.
  const p = w.player;
  p.attackT -= dt;
  if (p.knockedT <= 0) {
    const near = w.wolves.find((x) => x.hp > 0 && dist(x.pos, p.pos) < (x.species === 'bear' ? 1.25 : 1.05));
    if (near) {
      p.lookAt = near.pos;
      if (p.attackT <= 0) {
        p.attackT = 0.45;
        p.swing = 1;
        p.tool = 'axe';
        damageWolf(w, near, w.upgrades.sharpAxes ? 1.6 : 1);
        const dx = near.pos.x - p.pos.x;
        const dy = near.pos.y - p.pos.y;
        const len = Math.hypot(dx, dy) || 1;
        const kb = near.species === 'bear' ? 0.08 : 0.25;
        near.pos.x += (dx / len) * kb;
        near.pos.y += (dy / len) * kb;
      }
    }
  }

  // Towers shoot any predator in range.
  const dmg = TOWER_DAMAGE * (w.upgrades.ironArrows ? 1.75 : 1);
  for (const t of w.towers) {
    t.cooldown -= dt;
    let target: Wolf | null = null;
    let best = TOWER_RANGE;
    for (const wolf of w.wolves) {
      const dd = dist(wolf.pos, t.pos);
      if (wolf.hp > 0 && dd < best) {
        best = dd;
        target = wolf;
      }
    }
    if (!target) continue;
    t.aim = worldVecToScreenAngle(target.pos.x - t.pos.x, target.pos.y - t.pos.y);
    if (t.cooldown > 0) continue;
    t.cooldown = TOWER_COOLDOWN;
    w.arrows.push({ pos: { ...t.pos }, z: TOWER_TOP_Z, z0: TOWER_TOP_Z, startDist: Math.max(0.5, best), targetId: target.id, damage: dmg, angle: t.aim });
  }

  for (const a of w.arrows) {
    const target = w.wolves.find((x) => x.id === a.targetId && x.hp > 0);
    if (!target) {
      a.z = -1;
      continue;
    }
    const dx = target.pos.x - a.pos.x;
    const dy = target.pos.y - a.pos.y;
    const dd = Math.hypot(dx, dy);
    if (dd < 0.2) {
      damageWolf(w, target, a.damage);
      a.z = -1;
      continue;
    }
    const step = Math.min(dd, 11 * dt);
    a.pos.x += (dx / dd) * step;
    a.pos.y += (dy / dd) * step;
    a.z = 14 + (a.z0 - 14) * Math.min(1, dd / a.startDist);
    a.angle = worldVecToScreenAngle(dx, dy);
  }
  w.arrows = w.arrows.filter((a) => a.z >= 0);
  w.wolves = w.wolves.filter((x) => x.hp > 0);

  if (d.waveActive && !w.wolves.some((x) => x.mode === 'raid')) {
    d.waveActive = false;
    d.wavesCleared++;
    d.autoWaves = true;
    d.nextWaveIn = WAVE_INTERVAL;
    for (const door of Object.values(w.doors)) door.hp = door.max;
  }
  if (d.visible && !d.waveActive) d.health = Math.min(d.maxHealth, d.health + 3 * dt);
  if (d.visible && d.health <= 0) w.gameOver = true;
}
