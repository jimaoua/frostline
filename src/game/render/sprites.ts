/**
 * Sprite handling. Every sprite has a LOGICAL size in world-pixels plus an
 * anchor (usually the ground contact point). The backing canvas is rendered
 * at the current zoom × devicePixelRatio, so sprites stay crisp, and they are
 * always drawn with a single uniform scale — proportions never stretch.
 */
export interface Sprite {
  source: CanvasImageSource;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1): void {
  ctx.drawImage(s.source, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
}

export class SpriteCache {
  private map = new Map<string, Sprite>();
  private res = 1;

  /** Re-render cached sprites when the effective pixel density changes. */
  setResolution(r: number): void {
    const q = Math.max(0.5, Math.round(r * 4) / 4);
    if (q === this.res) return;
    this.res = q;
    this.map.clear();
  }

  get(key: string, w: number, h: number, ax: number, ay: number, paint: (g: CanvasRenderingContext2D) => void): Sprite {
    const hit = this.map.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * this.res);
    canvas.height = Math.ceil(h * this.res);
    const g = canvas.getContext('2d')!;
    g.scale(this.res, this.res);
    g.translate(ax, ay);
    paint(g);
    const s: Sprite = { source: canvas, w, h, ax, ay };
    this.map.set(key, s);
    return s;
  }
}

/**
 * Load bitmap art (PNG/WebP) for later art passes. Only a target HEIGHT is
 * given; width always follows the image's native aspect ratio.
 */
export function loadImageSprite(src: string, opts: { height: number; anchorX?: number; anchorY?: number }): Promise<Sprite> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const h = opts.height;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      resolve({ source: img, w, h, ax: w * (opts.anchorX ?? 0.5), ay: h * (opts.anchorY ?? 1) });
    };
    img.onerror = reject;
    img.src = src;
  });
}
