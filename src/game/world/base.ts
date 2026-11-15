import { MAP_SIZE } from '../core/constants';
import type { QuadrantId, Vec } from '../core/types';
import { QUADRANTS, type GateDef } from './layout';

const POSTS_PER_EDGE = 3;

export interface WallEdge {
  key: string;
  kind: 'h' | 'v';
  x: number;
  y: number;
  /** +1 when the inside tile is on the positive side of the line. */
  insideSign: 1 | -1;
}

const postKey = (p: Vec) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

/**
 * The base is the union of unlocked quadrants. The stockade is derived from
 * that union every time it changes: any tile edge with base on one side and
 * snow on the other becomes a wall, except edges claimed by a gate.
 */
export class BaseLayout {
  readonly unlocked = new Set<QuadrantId>(['core']);
  readonly inside = new Uint8Array(MAP_SIZE * MAP_SIZE);
  readonly wallKeys = new Set<string>();
  wallEdges: WallEdge[] = [];
  posts: Vec[] = [];
  pillars: Vec[] = [];
  gates: GateDef[] = [];
  version = 0;

  constructor() {
    this.rebuild();
  }

  /** Unlock a quadrant; returns the stockade posts that were removed. */
  unlock(q: QuadrantId): Vec[] {
    if (this.unlocked.has(q)) return [];
    const before = new Map(this.posts.map((p) => [postKey(p), p]));
    this.unlocked.add(q);
    this.rebuild();
    for (const p of this.posts) before.delete(postKey(p));
    return [...before.values()];
  }

  isInsideTile(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE) return false;
    return this.inside[ty * MAP_SIZE + tx] === 1;
  }

  isInside(x: number, y: number): boolean {
    return this.isInsideTile(Math.floor(x), Math.floor(y));
  }

  /** Move a circle of radius r by (dx, dy), stopping at stockade walls. */
  slide(pos: Vec, dx: number, dy: number, r: number): void {
    if (dx !== 0) {
      const lead = pos.x + Math.sign(dx) * r;
      const next = lead + dx;
      const crosses = dx > 0 ? Math.floor(next) > Math.floor(lead) : Math.floor(next) < Math.floor(lead);
      const line = dx > 0 ? Math.floor(next) : Math.floor(lead);
      if (crosses && this.blocked('v', line, pos.y, r)) pos.x = dx > 0 ? line - r - 0.001 : line + r + 0.001;
      else pos.x += dx;
    }
    if (dy !== 0) {
      const lead = pos.y + Math.sign(dy) * r;
      const next = lead + dy;
      const crosses = dy > 0 ? Math.floor(next) > Math.floor(lead) : Math.floor(next) < Math.floor(lead);
      const line = dy > 0 ? Math.floor(next) : Math.floor(lead);
      if (crosses && this.blocked('h', line, pos.x, r)) pos.y = dy > 0 ? line - r - 0.001 : line + r + 0.001;
      else pos.y += dy;
    }
  }

  private blocked(kind: 'h' | 'v', line: number, along: number, r: number): boolean {
    const a = Math.floor(along - r * 0.7);
    const b = Math.floor(along + r * 0.7);
    for (let t = a; t <= b; t++) {
      if (this.wallKeys.has(kind === 'v' ? `v:${line}:${t}` : `h:${t}:${line}`)) return true;
    }
    return false;
  }

  private isBoundary(key: string): boolean {
    const [kind, xs, ys] = key.split(':');
    const x = Number(xs);
    const y = Number(ys);
    return kind === 'h'
      ? this.isInsideTile(x, y - 1) !== this.isInsideTile(x, y)
      : this.isInsideTile(x - 1, y) !== this.isInsideTile(x, y);
  }

  private rebuild(): void {
    this.inside.fill(0);
    for (const q of this.unlocked) {
      const r = QUADRANTS[q].rect;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.inside[y * MAP_SIZE + x] = 1;
    }

    const gateEdges = new Set<string>();
    this.gates = [];
    for (const q of this.unlocked) {
      for (const g of QUADRANTS[q].gates) {
        if (!g.edges.every((e) => this.isBoundary(e))) continue;
        this.gates.push(g);
        g.edges.forEach((e) => gateEdges.add(e));
      }
      for (const h of QUADRANTS[q].hatches ?? []) if (this.isBoundary(h)) gateEdges.add(h);
    }

    this.wallKeys.clear();
    this.wallEdges = [];
    const add = (kind: 'h' | 'v', x: number, y: number, insideSign: 1 | -1) => {
      const key = `${kind}:${x}:${y}`;
      if (gateEdges.has(key) || this.wallKeys.has(key)) return;
      this.wallKeys.add(key);
      this.wallEdges.push({ key, kind, x, y, insideSign });
    };
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (!this.isInsideTile(x, y)) continue;
        if (!this.isInsideTile(x, y - 1)) add('h', x, y, 1);
        if (!this.isInsideTile(x, y + 1)) add('h', x, y + 1, -1);
        if (!this.isInsideTile(x - 1, y)) add('v', x, y, 1);
        if (!this.isInsideTile(x + 1, y)) add('v', x + 1, y, -1);
      }
    }

    this.posts = [];
    for (const e of this.wallEdges) {
      for (let i = 0; i < POSTS_PER_EDGE; i++) {
        const t = (i + 0.5) / POSTS_PER_EDGE;
        this.posts.push(e.kind === 'h' ? { x: e.x + t, y: e.y } : { x: e.x, y: e.y + t });
      }
    }

    this.pillars = [];
    for (const g of this.gates) {
      const parsed = g.edges.map((k) => k.split(':'));
      const kind = parsed[0][0];
      if (kind === 'h') {
        const xs = parsed.map((p) => Number(p[1]));
        const y = Number(parsed[0][2]);
        this.pillars.push({ x: Math.min(...xs), y }, { x: Math.max(...xs) + 1, y });
      } else {
        const ys = parsed.map((p) => Number(p[2]));
        const x = Number(parsed[0][1]);
        this.pillars.push({ x, y: Math.min(...ys) }, { x, y: Math.max(...ys) + 1 });
      }
    }
    for (const q of this.unlocked) {
      for (const h of QUADRANTS[q].hatches ?? []) {
        if (!this.isBoundary(h)) continue;
        const [, xs, ys] = h.split(':');
        this.pillars.push({ x: Number(xs), y: Number(ys) }, { x: Number(xs) + 1, y: Number(ys) });
      }
    }
    this.version++;
  }
}
