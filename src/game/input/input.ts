import { screenDirToWorldDir } from '../core/iso';
import type { Vec } from '../core/types';

const STICK_RADIUS = 56;
const DEADZONE = 0.12;

export interface StickState {
  active: boolean;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

/**
 * Keyboard (WASD / arrows) + a floating touch/mouse joystick that appears
 * wherever the player presses. Directions are read in screen space and
 * converted to world space so "up" on the stick is always up on screen.
 */
export class Input {
  readonly stick: StickState = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private down = { x: 0, y: 0, t: 0, moved: 0 };
  /** A short press that barely moved: a tap on the world (CSS px in the canvas). */
  private tap: Vec | null = null;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
  }

  /** Unit-or-less world vector. */
  worldDirection(): Vec {
    const s = this.screenVector();
    const mag = Math.min(1, Math.hypot(s.x, s.y));
    if (mag < DEADZONE) return { x: 0, y: 0 };
    const d = screenDirToWorldDir(s.x, s.y);
    return { x: d.x * mag, y: d.y * mag };
  }

  private screenVector(): Vec {
    if (this.stick.active) {
      const dx = this.stick.x - this.stick.ox;
      const dy = this.stick.y - this.stick.oy;
      return { x: dx / STICK_RADIUS, y: dy / STICK_RADIUS };
    }
    const k = this.keys;
    const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  get stickRadius(): number {
    return STICK_RADIUS;
  }

  private local(e: PointerEvent): Vec {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    // Presses on HUD buttons and panels are theirs: only the bare canvas
    // drives the joystick and counts as a tap on the world.
    if (!(e.target instanceof HTMLCanvasElement)) return;
    this.pointerId = e.pointerId;
    const p = this.local(e);
    Object.assign(this.stick, { active: true, ox: p.x, oy: p.y, x: p.x, y: p.y });
    this.down = { x: p.x, y: p.y, t: performance.now(), moved: 0 };
    e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const p = this.local(e);
    this.down.moved = Math.max(this.down.moved, Math.hypot(p.x - this.down.x, p.y - this.down.y));
    let dx = p.x - this.stick.ox;
    let dy = p.y - this.stick.oy;
    const d = Math.hypot(dx, dy);
    // Drag the base along when the finger outruns the stick.
    if (d > STICK_RADIUS) {
      const k = (d - STICK_RADIUS) / d;
      this.stick.ox += dx * k;
      this.stick.oy += dy * k;
      dx = p.x - this.stick.ox;
      dy = p.y - this.stick.oy;
    }
    this.stick.x = this.stick.ox + dx;
    this.stick.y = this.stick.oy + dy;
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.stick.active = false;
    if (e.type === 'pointerup' && this.down.moved < 12 && performance.now() - this.down.t < 320) this.tap = { x: this.down.x, y: this.down.y };
  };

  /** The last tap, once (null if none since the last call). */
  takeTap(): Vec | null {
    const t = this.tap;
    this.tap = null;
    return t;
  }

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
  };

  /** Drop any held direction (used when menus open or the app resumes). */
  clear(): void {
    this.onBlur();
  }

  private onBlur = () => {
    this.keys.clear();
    this.pointerId = null;
    this.stick.active = false;
  };
}
