export interface Light {
  /** Device-pixel position on screen. */
  x: number;
  y: number;
  /** Radius in device pixels. */
  r: number;
  strength: number;
}

/**
 * Night / storm light map. A dark-blue layer is painted over the scene, and
 * every light punches a soft hole through it ("destination-out"). Warm glows
 * are added on top separately so lit areas read as firelight, not daylight.
 */
export class LightMap {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;

  resize(w: number, h: number): void {
    // Half resolution is plenty for soft light and saves fill-rate on phones.
    this.canvas.width = Math.max(1, Math.round(w / 2));
    this.canvas.height = Math.max(1, Math.round(h / 2));
  }

  render(target: CanvasRenderingContext2D, lights: Light[], darkness: number, tint: string): void {
    if (darkness <= 0.01) return;
    const c = this.ctx;
    const k = 0.5;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.fillStyle = tint;
    c.globalAlpha = darkness;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const x = l.x * k;
      const y = l.y * k;
      const r = l.r * k;
      if (x < -r || y < -r || x > this.canvas.width + r || y > this.canvas.height + r) continue;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${l.strength})`);
      g.addColorStop(0.5, `rgba(0,0,0,${l.strength * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(this.canvas, 0, 0, target.canvas.width, target.canvas.height);
    target.restore();
  }
}
