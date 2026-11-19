
import { toScreen } from '../core/iso';
import { clamp, damp } from '../core/math';
import type { Pad, StructureId, World } from '../core/types';
import type { Input } from '../input/input';
import { nightAmount, warmRadius } from '../systems/settlement';
import { windVec } from '../systems/effects';
import { QUADRANTS, SPOTS } from '../world/layout';
import { drawHuman, drawWolf } from './characters';
import { padBumpAt, padShownRatio, padStageAt, stackSquash } from '../systems/feel';
import { SITE_STRUCTURES } from '../core/constants';
import { drawCave } from './cave';
import { drawStashFloor, drawStationZone, drawExpandZone, drawFireRing, drawPad, drawPadBadge, drawWarmZone } from './floor';
import { drawArrows, drawFireGlow, drawFlyers, drawFootprints, drawParticles, drawPopups, Snowfall } from './fx';
import { drawBaseEdges, drawGround, type View } from './ground';
import { drawIceHole, drawLake, drawLakeCamp, drawMarket, drawSmokehouse } from './lake';
import { LightMap, type Light } from './lighting';
import { drawNode } from './nature';
import { PLAYER_STYLE, SURVIVOR_STYLES, TRADER_STYLE, WORKER_STYLES } from './palette';
import { SpriteCache } from './sprites';
import { drawPillar, drawPost } from './stockade';
import {
  drawCampfire,
  drawCashPad,
  drawCounter,
  drawDoors,
  drawFishPond,
  drawFishShack,
  drawFlare,
  drawGhost,
  drawGrill,
  drawLumberHut,
  drawPile,
  drawQuarryCamp,
  drawShelter,
  drawSled,
  drawTower,
  drawTradeMat,
  drawTradingPost,
  drawTrap,
  drawWorkshop,
  sledPos,
  withSite,
  drawStashPiles,
  drawMineLodge,
  type SiteState,
} from './structures';

interface Drawable {
  depth: number;
  draw: () => void;
}

/** Where each building's lit window / lantern sits (world offset, height). */
const WINDOW_LIGHTS: Partial<Record<StructureId, [number, number, number, number]>> = {
  lumberHut: [0.85, -0.1, 17, 70],
  fishShack: [0.6, -0.1, 15, 60],
  workshop: [0.0, 0.75, 12, 95],
  shelter: [0.0, 0.75, 16, 90],
  tradingPost: [-0.8, 0.6, 40, 80],
  counter: [0.5, 0.32, 40, 80],
  grill: [0, 0, 18, 90],
};

/**
 * Canvas renderer. Pass order: ground → ground decals (edges, footprints,
 * pads, zones) → depth-sorted world objects (by x + y) → flying items and
 * particles → light map → popups → screen-space weather and overlays.
 * Everything scales uniformly with zoom.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private vw = 1;
  private vh = 1;
  private zoom = 1;
  private cam = { x: 0, y: 0 };
  private lead = { x: 0, y: 0 };
  private camReady = false;
  private sprites = new SpriteCache();
  private snow = new Snowfall();
  private light = new LightMap();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(w: number, h: number): void {
    this.vw = Math.max(1, w);
    this.vh = Math.max(1, h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    // Tight, arcade framing: ~5–6 tiles across on a phone.
    this.zoom = clamp(Math.min(this.vw, this.vh * 1.1) / 330, 1.0, 1.9);
    this.sprites.setResolution(this.zoom * this.dpr);
    this.snow.resize(this.vw, this.vh);
    this.light.resize(this.canvas.width, this.canvas.height);
  }

  snapCamera(w: World): void {
    const t = toScreen(w.player.pos.x, w.player.pos.y);
    this.cam = { x: t.x, y: t.y - 30 };
    this.camReady = true;
  }

  /**
   * The building under a tap (CSS px inside the canvas), front-most first.
   * Boxes are generous so a fingertip on the roof or the base both count.
   */
  pickStructure(w: World, cssX: number, cssY: number): StructureId | null {
    const sx = this.cam.x + (cssX - this.vw / 2) / this.zoom;
    const sy = this.cam.y + (cssY - this.vh / 2) / this.zoom;
    let best: StructureId | null = null;
    let bestDepth = -Infinity;
    for (const st of Object.values(w.structures)) {
      if (!st.built) continue;
      const a = toScreen(st.pos.x, st.pos.y);
      const halfW = Math.max(24, st.radius * 32 * 1.4 + 14);
      const h = PICK_HEIGHT[st.id] ?? (st.radius > 0 ? 64 : 22);
      if (Math.abs(sx - a.x) > halfW || sy < a.y - h || sy > a.y + 18) continue;
      const depth = st.pos.x + st.pos.y;
      if (depth > bestDepth) {
        bestDepth = depth;
        best = st.id;
      }
    }
    return best;
  }

  render(w: World, input: Input, dt: number): void {
    const ctx = this.ctx;
    if (!this.camReady) this.snapCamera(w);
    const p = w.player;
    const time = w.time;
    const night = nightAmount(w);

    // Camera leads slightly in the direction of travel.
    const vs = toScreen(p.vel.x, p.vel.y);
    this.lead.x += (vs.x * 0.35 - this.lead.x) * damp(3, dt);
    this.lead.y += (vs.y * 0.35 - this.lead.y) * damp(3, dt);
    const target = toScreen(p.pos.x, p.pos.y);
    const k = damp(6, dt);
    this.cam.x += (target.x + this.lead.x - this.cam.x) * k;
    this.cam.y += (target.y - 30 + this.lead.y - this.cam.y) * k;

    const z = this.zoom * this.dpr;
    const shake = w.shake > 0 ? w.shake * 7 : 0;
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    const tx = this.dpr * (this.vw / 2 + ox) - this.cam.x * z;
    const ty = this.dpr * (this.vh / 2 + oy) - this.cam.y * z;
    ctx.setTransform(z, 0, 0, z, tx, ty);
    const toDevice = (wx: number, wy: number, wz = 0) => {
      const s = toScreen(wx, wy, wz);
      return { x: s.x * z + tx, y: s.y * z + ty };
    };

    const hw = this.vw / 2 / this.zoom;
    const hh = this.vh / 2 / this.zoom;
    const view: View = { x0: this.cam.x - hw, x1: this.cam.x + hw, y0: this.cam.y - hh, y1: this.cam.y + hh };
    const visible = (sx: number, sy: number, m = 140) =>
      sx > view.x0 - m && sx < view.x1 + m && sy > view.y0 - m * 0.4 && sy < view.y1 + m * 1.8;

    /* ---------- Ground layer ---------- */
    drawGround(ctx, w, view, time);
    // Chapter 2: the frozen lake and its fishing holes lie flat on the ground.
    if (w.flags.lake) {
      drawLake(ctx, time);
      for (const n of w.nodes) {
        if (n.kind !== 'icehole') continue;
        const s = toScreen(n.pos.x, n.pos.y);
        if (visible(s.x, s.y)) drawIceHole(ctx, n, s.x, s.y, time);
      }
    }
    // Chapter 8: the cave floor and the mountain behind it.
    if (w.flags.caveFound) drawCave(ctx, time, w.flags.cave);
    drawBaseEdges(ctx, w);
    const S = w.structures;
    if (S.fishPond.built) {
      const s = toScreen(S.fishPond.pos.x, S.fishPond.pos.y);
      drawFishPond(ctx, s.x, s.y, time);
    }
    drawFootprints(ctx, w, view);

    const fs = toScreen(S.campfire.pos.x, S.campfire.pos.y);
    if (w.flags.fireAcceptsWood && !w.fire.lit) drawFireRing(ctx, w, fs.x, fs.y);
    if (w.event?.kind === 'blizzard') drawWarmZone(ctx, fs.x, fs.y, warmRadius(w), time);
    for (const pad of Object.values(w.pads)) {
      if (!pad.active) continue;
      if (pad.effect.type === 'expand') drawExpandZone(ctx, QUADRANTS[pad.effect.quadrant].rect, time);
    }
    for (const pad of Object.values(w.pads)) {
      if (!pad.active && !pad.locked) continue;
      const s = toScreen(pad.pos.x, pad.pos.y);
      drawPad(ctx, w, pad, s.x, s.y);
    }
    if (S.tradeMat.built) {
      const s = toScreen(S.tradeMat.pos.x, S.tradeMat.pos.y);
      drawTradeMat(ctx, w.coinPile, s.x, s.y, time, S.tradeMat.bumpAt);
    }
    if (S.marketMat.built) {
      const s = toScreen(S.marketMat.pos.x, S.marketMat.pos.y);
      drawTradeMat(ctx, w.marketCash, s.x, s.y, time, S.marketMat.bumpAt);
    }
    if (S.cashPad.built) {
      const s = toScreen(S.cashPad.pos.x, S.cashPad.pos.y);
      drawCashPad(ctx, w.kitchen.cash, S.cashPad.bumpAt, s.x, s.y, time);
    }
    // Stand-here spots for the kitchen: hand fish to the grill, serve meals.
    const near = (q: { x: number; y: number }, r: number) => Math.hypot(p.pos.x - q.x, p.pos.y - q.y) < r;
    if (S.grill.built) {
      const z = SPOTS.grillZone;
      const s = toScreen(z.x, z.y);
      const fish = p.carry.includes('fish');
      const kind = fish || w.kitchen.tray === 0 ? 'fish' : 'meal';
      drawStationZone(ctx, w, kind, s.x, s.y, fish || (w.kitchen.tray > 0 && p.carry.length < p.capacity), near(z, 0.6));
    }
    if (S.counter.built) {
      const z = SPOTS.counterServe;
      const s = toScreen(z.x, z.y);
      drawStationZone(ctx, w, 'meal', s.x, s.y, p.carry.includes('meal'), near(z, 0.6));
    }
    if (S.stash.built) {
      const s = toScreen(S.stash.pos.x, S.stash.pos.y);
      drawStashFloor(ctx, w, s.x, s.y, p.carry.length > 0, near(S.stash.pos, 0.75));
    }
    for (const t of w.traps) {
      const s = toScreen(t.pos.x, t.pos.y);
      if (visible(s.x, s.y)) drawTrap(ctx, t, s.x, s.y, time);
    }

    /* ---------- Depth-sorted world ---------- */
    const items: Drawable[] = [];
    const sp = this.sprites;
    const windSway = 1 + w.weather.intensity * 3 + w.weather.gust * 2;
    for (const q of w.base.posts) {
      const s = toScreen(q.x, q.y);
      if (visible(s.x, s.y)) items.push({ depth: q.x + q.y, draw: () => drawPost(ctx, sp, s.x, s.y) });
    }
    for (const q of w.base.pillars) {
      const s = toScreen(q.x, q.y);
      if (visible(s.x, s.y)) items.push({ depth: q.x + q.y + 0.01, draw: () => drawPillar(ctx, sp, s.x, s.y) });
    }
    for (const g of w.base.gates) {
      const door = w.doors[g.id];
      if (!door) continue;
      const mid = { x: (g.inPoint.x + g.outPoint.x) / 2, y: (g.inPoint.y + g.outPoint.y) / 2 };
      const s = toScreen(mid.x, mid.y);
      items.push({
        depth: mid.x + mid.y + 0.02,
        draw: () => {
          ctx.save();
          ctx.translate(s.x, s.y);
          drawDoors(ctx, g, door, mid, time);
          ctx.restore();
        },
      });
    }
    for (const n of w.nodes) {
      if (!n.visible || n.kind === 'icehole') continue;
      const s = toScreen(n.pos.x, n.pos.y);
      if (visible(s.x, s.y, 200)) items.push({ depth: n.pos.x + n.pos.y, draw: () => drawNode(ctx, sp, n, s.x, s.y, time, windSway) });
    }

    for (const st of Object.values(S)) {
      // Not built yet, but being paid for: draw it as a construction site.
      const site = st.built ? null : siteFor(w, st.id);
      if (!st.built && !site) continue;
      const s = toScreen(st.pos.x, st.pos.y);
      if (!visible(s.x, s.y, 240)) continue;
      const depth = st.pos.x + st.pos.y;
      const b = st.builtAt;
      let draw: (() => void) | null = null;
      let dd = 0;
      switch (st.id) {
        case 'campfire':
          draw = () => drawCampfire(ctx, w, s.x, s.y, time);
          break;
        case 'grill':
          draw = () => drawGrill(ctx, w.kitchen, st.bumpAt, s.x, s.y, time, b);
          break;
        case 'counter':
          draw = () => drawCounter(ctx, w.kitchen.counter, st.bumpAt, s.x, s.y, time, b, night);
          dd = -0.3;
          break;
        case 'lumberHut':
          draw = () => drawLumberHut(ctx, s.x, s.y, time, b, night);
          dd = 0.4;
          break;
        case 'fishShack':
          draw = () => drawFishShack(ctx, s.x, s.y, time, b, night);
          dd = 0.3;
          break;
        case 'tradingPost':
          draw = () => drawTradingPost(ctx, s.x, s.y, time, b, night);
          dd = 0.4;
          break;
        case 'quarryCamp':
          draw = () => drawQuarryCamp(ctx, s.x, s.y, time, b);
          dd = 0.3;
          break;
        case 'workshop':
          draw = () => drawWorkshop(ctx, s.x, s.y, time, b, night);
          dd = 0.5;
          break;
        case 'shelter':
          draw = () => drawShelter(ctx, s.x, s.y, time, b, night);
          dd = 0.5;
          break;
        case 'woodpile':
          draw = () => drawPile(ctx, 'wood', w.stock.wood, s.x, s.y, st.bumpAt, time);
          break;
        case 'stonepile':
          draw = () => drawPile(ctx, 'stone', w.stock.stone, s.x, s.y, st.bumpAt, time);
          break;
        case 'stash':
          draw = () => drawStashPiles(ctx, w.stash, st.bumpAt, s.x, s.y, time);
          dd = -0.3;
          break;
        case 'smokehouse':
          draw = () => drawSmokehouse(ctx, w.smoke, st.bumpAt, s.x, s.y, time, b, night);
          dd = 0.4;
          break;
        case 'market':
          draw = () => drawMarket(ctx, s.x, s.y, time, b, night);
          dd = 0.3;
          break;
        case 'lakeCamp':
          draw = () => drawLakeCamp(ctx, s.x, s.y, time, b, night);
          dd = 0.3;
          break;
        case 'mineLodge':
          draw = () => drawMineLodge(ctx, s.x, s.y, time, b, night);
          dd = 0.3;
          break;
        case 'tower1':
        case 'tower2':
        case 'tower3': {
          const t = w.towers.find((x) => x.id === st.id) ?? (site ? { id: st.id, pos: st.pos, cooldown: 0, aim: 0 } : undefined);
          if (t) draw = () => drawTower(ctx, t, s.x, s.y, time, b, night);
          dd = 0.2;
          break;
        }
        default:
          break;
      }
      if (draw && site) {
        const d = draw;
        items.push({ depth: depth + dd, draw: () => withSite(site, d) });
      } else if (draw) items.push({ depth: depth + dd, draw });
    }

    for (const pad of Object.values(w.pads)) {
      if (!pad.active || !pad.ghost) continue;
      // Once the first item lands, the site replaces the blueprint.
      if (padShownRatio(pad) > 0 && padHasSite(pad)) continue;
      const s = toScreen(pad.ghost.at.x, pad.ghost.at.y);
      items.push({ depth: pad.ghost.at.x + pad.ghost.at.y + 0.3, draw: () => drawGhost(ctx, pad, s.x, s.y, time) });
    }

    const wind = windVec(w);
    const windX = wind.x - wind.y;
    for (const wk of w.workers) {
      const s = toScreen(wk.pos.x, wk.pos.y);
      if (!visible(s.x, s.y)) continue;
      const tool =
        wk.role === 'lumberjack' ? 'axe' : wk.role === 'miner' ? 'pick' : (wk.role === 'fisher' || wk.role === 'icefisher') && wk.state === 'working' ? 'rod' : null;
      items.push({
        depth: wk.pos.x + wk.pos.y,
        draw: () =>
          drawHuman(ctx, s.x, s.y, wk, WORKER_STYLES[wk.role], {
            held: wk.carry,
            swing: wk.swing,
            tool,
            showToolIdle: tool !== null && wk.carry.length === 0,
            time,
            shiver: wk.state === 'huddle',
            wind: windX,
          }),
      });
    }
    for (const sv of w.survivors) {
      const s = toScreen(sv.pos.x, sv.pos.y);
      if (!visible(s.x, s.y)) continue;
      items.push({
        depth: sv.pos.x + sv.pos.y,
        draw: () =>
          drawHuman(ctx, s.x, s.y, sv, SURVIVOR_STYLES[sv.look], {
            held: sv.carryMeal ? ['meal'] : [],
            swing: 0,
            tool: null,
            time,
            hop: sv.hop,
            emote: sv.emote,
            shiver: sv.emote === 'cold' || sv.state === 'huddle',
            wind: windX,
          }),
      });
    }
    for (const wolf of w.wolves) {
      const s = toScreen(wolf.pos.x, wolf.pos.y);
      if (visible(s.x, s.y)) items.push({ depth: wolf.pos.x + wolf.pos.y, draw: () => drawWolf(ctx, s.x, s.y, wolf, time) });
    }
    const cv = w.caravan;
    if (cv) {
      const sl = sledPos(cv);
      const ss = toScreen(sl.x, sl.y);
      items.push({ depth: sl.x + sl.y, draw: () => drawSled(ctx, ss.x, ss.y, cv.flip, time, night) });
      const s = toScreen(cv.pos.x, cv.pos.y);
      items.push({ depth: cv.pos.x + cv.pos.y, draw: () => drawHuman(ctx, s.x, s.y, cv, TRADER_STYLE, { held: [], swing: 0, tool: null, time, wind: windX }) });
    }
    if (w.flare) {
      const f = w.flare;
      const s = toScreen(f.x, f.y);
      items.push({ depth: f.x + f.y, draw: () => drawFlare(ctx, s.x, s.y, time) });
    }

    const ps = toScreen(p.pos.x, p.pos.y);
    const bump = (time - p.bumpAt) / 0.25;
    if (p.knockedT <= 0) {
      items.push({
        depth: p.pos.x + p.pos.y,
        draw: () =>
          drawHuman(ctx, ps.x, ps.y, p, PLAYER_STYLE, {
            held: p.carry,
            cash: w.coins,
            swing: p.swing,
            tool: p.tool === 'rod' && Math.hypot(p.pos.x - SPOTS.fishSpot.x, p.pos.y - SPOTS.fishSpot.y) > 1 ? null : p.tool,
            time,
            full: p.carry.length >= p.capacity,
            bump: bump >= 0 && bump < 1 ? bump : 0,
            shiver: p.warmth < 40,
            wind: windX,
            stackSquash: stackSquash(w),
          }),
      });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    drawFlyers(ctx, w);
    drawArrows(ctx, w);
    drawParticles(ctx, w);

    /* ---------- Lighting ---------- */
    const darkness = night * 0.62 + w.weather.intensity * 0.12;
    if (darkness > 0.01) {
      const zz = z;
      const lights: Light[] = [];
      if (w.fire.lit) {
        const d = toDevice(S.campfire.pos.x, S.campfire.pos.y, 14);
        lights.push({ x: d.x, y: d.y, r: (230 * (w.upgrades.bonfire ? 1.3 : 1) + Math.sin(time * 9) * 8) * zz, strength: 1 });
      }
      for (const [id, spec] of Object.entries(WINDOW_LIGHTS) as [StructureId, [number, number, number, number]][]) {
        const st = S[id];
        if (!st.built) continue;
        const d = toDevice(st.pos.x + spec[0], st.pos.y + spec[1], spec[2]);
        lights.push({ x: d.x, y: d.y, r: spec[3] * zz, strength: 0.75 });
      }
      for (const t of w.towers) {
        const d = toDevice(t.pos.x + 0.52, t.pos.y + 0.52, 70);
        lights.push({ x: d.x, y: d.y, r: 100 * zz, strength: 0.8 });
      }
      if (cv) {
        const sl = sledPos(cv);
        const d = toDevice(sl.x, sl.y, 46);
        lights.push({ x: d.x, y: d.y, r: 110 * zz, strength: 0.85 });
      }
      if (w.flare) {
        const d = toDevice(w.flare.x, w.flare.y, 24);
        lights.push({ x: d.x, y: d.y, r: 170 * zz, strength: 1 });
      }
      const pd = toDevice(p.pos.x, p.pos.y, 26);
      lights.push({ x: pd.x, y: pd.y, r: 80 * zz, strength: 0.45 * night });
      this.light.render(ctx, lights, darkness, night > 0.1 ? '#0e1838' : '#cfdcea');
    }
    drawFireGlow(ctx, w, night);
    // Dusk / dawn warmth.
    const dusk = Math.sin(clamp(night, 0, 1) * Math.PI) * 0.12;
    if (dusk > 0.005) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,140,90,${dusk})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    drawPopups(ctx, w);

    // Price badges stay crisp and readable on top of everything, day or night.
    for (const pad of Object.values(w.pads)) {
      if (!pad.active && !pad.locked) continue;
      // Building pads: the price floats above the plot, over the roof line,
      // so it still marks where to stand but never hides the pad or the
      // construction rising on it.
      // Level pads sit beside their station: their rows float a little higher
      // so they don't sit on top of it (e.g. the stash below its upgrade pad).
      const lift = padHasSite(pad) && !pad.locked ? (pad.ghost?.h ?? 40) + 26 : pad.effect.type === 'level' && !pad.locked ? 30 : 0;
      const s = toScreen(pad.pos.x, pad.pos.y, lift);
      if (visible(s.x, s.y, 60)) drawPadBadge(ctx, w, pad, s.x, s.y, this.zoom);
    }

    // Objective guide: a bouncing chevron over the target.
    const guide = w.guide;
    const guideOnPad = guide && Object.values(w.pads).some((pd) => pd.active && Math.hypot(pd.pos.x - guide.x, pd.pos.y - guide.y) < 0.3);
    if (guide && !guideOnPad) {
      const gs = toScreen(guide.x, guide.y, 62);
      if (visible(gs.x, gs.y, -20)) {
        const by = Math.abs(Math.sin(time * 4.5)) * 8;
        ctx.save();
        ctx.translate(gs.x, gs.y - by);
        ctx.scale(1 / this.zoom, 1 / this.zoom);
        ctx.beginPath();
        ctx.moveTo(-11, -12);
        ctx.lineTo(11, -12);
        ctx.lineTo(0, 3);
        ctx.closePath();
        ctx.fillStyle = '#ffe066';
        ctx.strokeStyle = 'rgba(90,50,0,0.75)';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Tutorial hand: taps the target during the opening missions.
    if (guide && w.guideHand) {
      const hs = toScreen(guide.x, guide.y, 4);
      if (visible(hs.x, hs.y, -20)) drawTapHand(ctx, hs.x, hs.y, time, this.zoom);
    }

    /* ---------- Screen space ---------- */
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.snow.draw(ctx, this.vw, this.vh, dt, time, windX * 0.6, (wind.x + wind.y) * 0.2, w.weather.intensity);

    const vg = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.42, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.78);
    vg.addColorStop(0, 'rgba(120,150,190,0)');
    vg.addColorStop(1, `rgba(70,100,150,${0.3 + night * 0.25})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);

    // Frost creeping in when the player is freezing.
    const cold = clamp(1 - p.warmth / 70, 0, 1);
    if (cold > 0.01) {
      const fg = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.25, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.7);
      fg.addColorStop(0, 'rgba(220,240,255,0)');
      fg.addColorStop(1, `rgba(220,240,255,${0.75 * cold})`);
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    // Hurt / knockout flash.
    if (w.flash > 0 || p.hurtT > 0) {
      const a = Math.max(w.flash * 0.45, p.hurtT * 0.9);
      const hg = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.2, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.7);
      hg.addColorStop(0, 'rgba(255,60,50,0)');
      hg.addColorStop(1, `rgba(255,60,50,${clamp(a, 0, 0.45)})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    if (p.knockedT > 0) {
      ctx.fillStyle = `rgba(10,16,30,${clamp(p.knockedT / 2.2, 0, 0.75)})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Knocked out…', this.vw / 2, this.vh / 2);
    }

    // Off-screen pointers: objective guide (yellow) and scout flare (red).
    const edgeArrow = (wx: number, wy: number, color: string) => {
      const d = toDevice(wx, wy, 20);
      const sx = d.x / this.dpr;
      const sy = d.y / this.dpr;
      const m = 34;
      const top = Math.min(this.vh * 0.42, 270);
      if (!(sx < m || sx > this.vw - m || sy < top || sy > this.vh - m)) return;
      const cx = this.vw / 2;
      const cy = this.vh / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(cx + Math.cos(ang) * this.vw, m, this.vw - m);
      const ey = clamp(cy + Math.sin(ang) * this.vh, top, this.vh - m);
      const pulse = 1 + Math.sin(time * 6) * 0.1;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(40,24,0,0.75)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-9, -12);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    if (w.flare) edgeArrow(w.flare.x, w.flare.y, '#ff5a45');
    if (guide) edgeArrow(guide.x, guide.y, '#ffe066');

    const st = input.stick;
    if (st.active) {
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, input.stickRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,32,48,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(st.x, st.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  }
}

/** A white cartoon glove that taps (fingertip at x, y), with a ripple on each tap. */
function drawTapHand(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, zoom: number): void {
  const cyc = (time * 1.25) % 1;
  const press = cyc < 0.35 ? Math.sin((cyc / 0.35) * Math.PI) : 0;
  const lift = 10 - press * 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / zoom, 1 / zoom);
  // Ripple where the finger lands.
  if (cyc > 0.15 && cyc < 0.75) {
    const r = (cyc - 0.15) / 0.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 + r * 26, (8 + r * 26) * 0.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,224,102,${0.9 * (1 - r)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.translate(14, -lift - 4);
  ctx.rotate(-0.35);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1d2633';
  ctx.fillStyle = '#ffffff';
  // Finger.
  ctx.beginPath();
  ctx.roundRect(-5.5, -30, 11, 32, 5.5);
  ctx.fill();
  ctx.stroke();
  // Palm.
  ctx.beginPath();
  ctx.roundRect(-9, -52, 31, 28, 10);
  ctx.fill();
  ctx.stroke();
  // Knuckle lines and cuff.
  ctx.beginPath();
  ctx.moveTo(4, -36);
  ctx.lineTo(4, -28);
  ctx.moveTo(12, -36);
  ctx.lineTo(12, -28);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-7, -62, 27, 11, 4);
  ctx.fillStyle = '#4aa3ff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

const padHasSite = (pad: Pad) => pad.effect.type === 'build' && pad.effect.structures.some((id) => SITE_STRUCTURES.has(id));

/** The pad that builds each structure (pads never change, so look it up once). */
const builders = new WeakMap<World, Map<StructureId, Pad>>();

/** Construction-site state for an unbuilt structure whose pad is being paid. */
function siteFor(w: World, id: StructureId): SiteState | null {
  if (!SITE_STRUCTURES.has(id)) return null;
  let map = builders.get(w);
  if (!map) {
    map = new Map();
    for (const pad of Object.values(w.pads)) {
      if (pad.effect.type === 'build') for (const sid of pad.effect.structures) map.set(sid, pad);
    }
    builders.set(w, map);
  }
  const pad = map.get(id);
  if (!pad || pad.completed) return null;
  const q = padShownRatio(pad);
  if (q <= 0) return null;
  return { q, stageAt: padStageAt(pad), bumpAt: padBumpAt(pad) };
}

/** How tall each building stands on screen, for tap picking (px above its base). */
const PICK_HEIGHT: Partial<Record<StructureId, number>> = {
  campfire: 40,
  grill: 46,
  counter: 46,
  tower1: 110,
  tower2: 110,
  tower3: 110,
  workshop: 80,
  shelter: 80,
};
