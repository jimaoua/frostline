import { C } from './palette';
import { ellipse, roundRectPath, softShadow } from './shapes';
import { drawSprite, type SpriteCache } from './sprites';

type Ctx = CanvasRenderingContext2D;

function paintPost(g: Ctx, r: number, h: number, pillar: boolean): void {
  softShadow(g, 3, 1, r + 5, (r + 5) * 0.5, 0.3);
  const grad = g.createLinearGradient(-r, 0, r, 0);
  grad.addColorStop(0, pillar ? '#a8693c' : '#eab27a');
  grad.addColorStop(0.35, pillar ? '#8a5230' : C.wood);
  grad.addColorStop(1, pillar ? '#4a2a14' : '#6e3d1e');
  g.fillStyle = grad;
  g.fillRect(-r, -h, r * 2, h);
  ellipse(g, 0, 0, r, r * 0.5, pillar ? '#4a2a14' : '#6e3d1e');
  // Bark streaks.
  g.strokeStyle = 'rgba(70,35,15,0.35)';
  g.lineWidth = 0.8;
  for (const x of [-r * 0.4, r * 0.25]) {
    g.beginPath();
    g.moveTo(x, -h + 4);
    g.lineTo(x + 0.5, -2);
    g.stroke();
  }

  // Painted band wrapping around the log.
  const by = -h * 0.55;
  const bh = h * 0.22;
  const band = g.createLinearGradient(-r, 0, r, 0);
  band.addColorStop(0, '#7cc0f2');
  band.addColorStop(0.4, C.band);
  band.addColorStop(1, '#1d4a78');
  g.fillStyle = band;
  g.beginPath();
  g.moveTo(-r, by);
  g.ellipse(0, by, r, r * 0.5, 0, Math.PI, 0, true);
  g.lineTo(r, by - bh);
  g.ellipse(0, by - bh, r, r * 0.5, 0, 0, Math.PI, false);
  g.closePath();
  g.fill();

  // Cut top with rings, then a snow cap.
  ellipse(g, 0, -h, r, r * 0.5, C.logEnd);
  ellipse(g, 0, -h, r * 0.65, r * 0.32, '#e2b07a');
  ellipse(g, 0, -h, r * 0.35, r * 0.17, C.logRing);
  ellipse(g, 0, -h, r * 0.12, r * 0.06, C.woodDark);
  g.fillStyle = '#ffffff';
  roundRectPath(g, -r * 0.95, -h - r * 0.6, r * 1.4, r * 0.65, r * 0.32);
  g.fill();
  if (pillar) {
    // Iron bands on gate pillars.
    g.fillStyle = '#3a3f48';
    g.fillRect(-r, -h * 0.25, r * 2, 2);
    g.fillRect(-r, -h * 0.85, r * 2, 2);
  }
}

export function drawPost(ctx: Ctx, cache: SpriteCache, sx: number, sy: number): void {
  drawSprite(ctx, cache.get('post', 26, 40, 12, 33, (g) => paintPost(g, 6.6, 26, false)), sx, sy);
}

export function drawPillar(ctx: Ctx, cache: SpriteCache, sx: number, sy: number): void {
  drawSprite(ctx, cache.get('pillar', 32, 58, 15, 49, (g) => paintPost(g, 8.6, 40, true)), sx, sy);
}
