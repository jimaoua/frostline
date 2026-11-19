import { toScreen } from '../core/iso';
import { CAVE, CAVE_MOUTH } from '../world/layout';
import { ellipse, onGround } from './shapes';

type Ctx = CanvasRenderingContext2D;

/** Height of the mountain ridge (px) along the world x axis behind the cave. */
const ridgeH = (x: number) => 46 + 112 * Math.exp(-(((x - 20) / 3.6) ** 2)) + 18 * Math.sin(x * 2.3) + 10 * Math.sin(x * 5.1);
const RIDGE_Y = 0.9;
const RIDGE_X0 = 13.8;
const RIDGE_X1 = 26.2;

/**
 * Chapter 8 scenery, drawn flat before everything that stands: the rocky cave
 * floor, the mountain at the north edge of the map and the dark cave mouth.
 * Once the Miners' Lodge is built, timber frames and lanterns light it up.
 */
export function drawCave(ctx: Ctx, time: number, lit: boolean): void {
  // Cave floor: gravel and frost.
  const c = toScreen(CAVE.x, CAVE.y);
  onGround(ctx, c.x, c.y, () => {
    ctx.save();
    ctx.scale(CAVE.rx, CAVE.ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,118,124,0.55)';
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(80,78,86,0.35)';
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / 26);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * CAVE.rx * 0.9, Math.sin(a) * r * CAVE.ry * 0.9, 0.08 + (i % 3) * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // The ridge: one jagged silhouette running along the map's north edge.
  const base: { x: number; y: number }[] = [];
  const top: { x: number; y: number }[] = [];
  for (let x = RIDGE_X0; x <= RIDGE_X1 + 0.01; x += 0.4) {
    const s = toScreen(x, RIDGE_Y);
    base.push(s);
    top.push({ x: s.x, y: s.y - ridgeH(x) });
  }
  const path = (pts: { x: number; y: number }[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, base[0].y - 170, 0, base[base.length - 1].y);
  g.addColorStop(0, '#6e7886');
  g.addColorStop(1, '#3f4754');
  path([...base, ...top.slice().reverse()]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,36,46,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Snow on the upper third of the ridge.
  const snowLow = top.map((p, i) => ({ x: p.x, y: p.y + (base[i].y - p.y) * (0.28 + 0.06 * Math.sin(i * 1.7)) }));
  path([...snowLow, ...top.slice().reverse()]);
  ctx.fillStyle = '#eef4fa';
  ctx.fill();
  // Rock-face strata.
  ctx.strokeStyle = 'rgba(30,36,46,0.28)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    base.forEach((p, i) => {
      const y = p.y - (p.y - top[i].y) * (k * 0.17);
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    });
    ctx.stroke();
  }

  // Cave mouth: a dark arch at the foot of the highest peak.
  const m = toScreen(CAVE_MOUTH.x, CAVE_MOUTH.y);
  const mw = 30;
  const mh = 40;
  ctx.beginPath();
  ctx.moveTo(m.x - mw, m.y);
  ctx.quadraticCurveTo(m.x - mw, m.y - mh * 1.25, m.x, m.y - mh * 1.25);
  ctx.quadraticCurveTo(m.x + mw, m.y - mh * 1.25, m.x + mw, m.y);
  ctx.closePath();
  const dark = ctx.createLinearGradient(0, m.y - mh, 0, m.y);
  dark.addColorStop(0, '#0d1016');
  dark.addColorStop(1, lit ? '#3a2a18' : '#1a1e26');
  ctx.fillStyle = dark;
  ctx.fill();
  if (lit) {
    // Timber frame and a warm glow from inside.
    ctx.globalCompositeOperation = 'lighter';
    ellipse(ctx, m.x, m.y - 12, 26, 16, `rgba(255,170,70,${0.22 + 0.05 * Math.sin(time * 6)})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(m.x - mw + 2, m.y - mh - 4, 5, mh + 4);
    ctx.fillRect(m.x + mw - 7, m.y - mh - 4, 5, mh + 4);
    ctx.fillRect(m.x - mw - 2, m.y - mh - 8, mw * 2 + 4, 6);
    for (const [lx, ly] of [
      [16.6, 3.0],
      [23.4, 3.0],
      [18.2, 5.6],
      [21.8, 5.6],
    ]) drawLantern(ctx, lx, ly, time);
  }
}

function drawLantern(ctx: Ctx, x: number, y: number, time: number): void {
  const s = toScreen(x, y);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(s.x - 1.2, s.y - 26, 2.4, 26);
  ctx.fillRect(s.x - 1.2, s.y - 26, 7, 2);
  const f = 0.75 + 0.25 * Math.sin(time * 7 + x);
  ctx.globalCompositeOperation = 'lighter';
  ellipse(ctx, s.x + 5, s.y - 20, 12 * f, 12 * f, 'rgba(255,180,80,0.28)');
  ctx.globalCompositeOperation = 'source-over';
  ellipse(ctx, s.x + 5, s.y - 20, 2.6, 3.2, '#ffd27a');
}
