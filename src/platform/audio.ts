import type { Sfx } from '../game/core/types';
import { settings } from './settings';

/**
 * All sound is synthesised with WebAudio: no audio files to download, tiny
 * bundle, and every cue can be pitch-varied so repeats never sound robotic.
 *
 * iOS only allows audio after a touch, so `unlock()` is called from the first
 * tap (the Play button). Music is a soft generative loop: a slow drone, wind,
 * and a pentatonic pluck melody that never repeats exactly.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private lastPlayed = new Map<Sfx, number>();
  private musicTimer = 0;
  private nextNoteAt = 0;
  private melodyIdx = 4;
  private droneNodes: AudioNode[] = [];
  private suspended = false;

  /** Create / resume the context. Must run inside a user gesture on iOS. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = settings.sound ? 1 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = settings.music ? 1 : 0;
      this.musicBus.connect(this.master);
      this.noise = this.makeNoise();
      // A silent blip fully unlocks iOS output.
      const b = this.ctx.createBufferSource();
      b.buffer = this.ctx.createBuffer(1, 1, 22050);
      b.connect(this.master);
      b.start();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.suspended = false;
    this.startMusic();
  }

  /** Called when the app goes to the background or the game is paused. */
  suspend(): void {
    this.suspended = true;
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (!this.ctx) return;
    this.suspended = false;
    void this.ctx.resume();
  }

  applySettings(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(settings.sound ? 1 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.music ? 1 : 0, t, 0.3);
  }

  play(id: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.suspended || !settings.sound || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Rate-limit each cue so bursts (many coins) stay pleasant.
    const gap = id === 'land_coin' ? 0.045 : id === 'step' ? 0.12 : 0.06;
    if (now - (this.lastPlayed.get(id) ?? -1) < gap) return;
    this.lastPlayed.set(id, now);
    const v = () => 1 + (Math.random() - 0.5) * 0.08; // ±4% pitch variety

    switch (id) {
      case 'step':
        this.noiseHit(now, 0.05, 'bandpass', 1400 * v(), 0.035, 1.2);
        break;
      case 'chop':
        this.noiseHit(now, 0.07, 'lowpass', 1100, 0.22);
        this.tone(now, 'sine', 170 * v(), 0.09, 0.28, 85);
        break;
      case 'mine':
        this.tone(now, 'square', 880 * v(), 0.05, 0.06, 620);
        this.noiseHit(now, 0.05, 'highpass', 2500, 0.12);
        break;
      case 'catch':
        this.tone(now, 'sine', 520 * v(), 0.14, 0.14, 1150);
        this.noiseHit(now, 0.12, 'bandpass', 900, 0.08, 0.8);
        break;
      case 'land_wood':
        this.tone(now, 'triangle', 210 * v(), 0.06, 0.16, 160);
        break;
      case 'land_stone':
      case 'land_ore':
        this.tone(now, 'square', (id === 'land_ore' ? 420 : 300) * v(), 0.05, 0.05, 220);
        break;
      case 'land_salmon':
      case 'land_smoked':
      case 'land_fish':
        this.tone(now, 'sine', 560 * v(), 0.07, 0.12, 360);
        break;
      case 'land_meal':
        this.tone(now, 'sine', 760 * v(), 0.06, 0.1, 980);
        break;
      case 'land_coin': {
        const f = 1320 * v();
        this.tone(now, 'sine', f, 0.12, 0.07);
        this.tone(now + 0.04, 'sine', f * 1.335, 0.16, 0.06);
        break;
      }
      case 'cooked':
        this.noiseHit(now, 0.18, 'highpass', 3000, 0.05);
        this.tone(now + 0.05, 'sine', 990, 0.18, 0.06);
        break;
      case 'build':
        this.noiseHit(now, 0.35, 'lowpass', 600, 0.12, 0.5, 2400);
        this.arp(now + 0.05, [523, 659, 784, 1047], 0.07, 'triangle', 0.12, 0.35);
        break;
      case 'upgrade':
        this.arp(now, [587, 740, 880, 1175], 0.06, 'triangle', 0.12, 0.3);
        break;
      case 'mission':
        this.arp(now, [784, 1047], 0.1, 'sine', 0.14, 0.4);
        break;
      case 'levelup':
        this.arp(now, [523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.14, 0.7);
        this.arp(now + 0.02, [262, 330, 392, 523], 0.08, 'sine', 0.08, 0.6);
        break;
      case 'fire':
        this.noiseHit(now, 0.9, 'lowpass', 300, 0.25, 0.7, 1800);
        this.tone(now, 'sine', 90, 0.8, 0.2, 60);
        break;
      case 'hit':
        this.noiseHit(now, 0.08, 'lowpass', 1800, 0.2);
        this.tone(now, 'sine', 140 * v(), 0.1, 0.22, 70);
        break;
      case 'hurt':
        this.tone(now, 'sawtooth', 240, 0.22, 0.12, 90);
        this.noiseHit(now, 0.1, 'lowpass', 900, 0.15);
        break;
      case 'drop':
        this.noiseHit(now, 0.25, 'lowpass', 500, 0.25);
        break;
      case 'howl':
        this.howl(now);
        break;
      case 'day':
        this.tone(now, 'sine', 659, 0.9, 0.08);
        this.tone(now + 0.18, 'sine', 988, 1.1, 0.06);
        break;
    }
  }

  // --- building blocks ---------------------------------------------------

  private tone(at: number, type: OscillatorType, freq: number, dur: number, vol: number, slideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private arp(at: number, notes: number[], step: number, type: OscillatorType, vol: number, tail: number): void {
    notes.forEach((f, i) => this.tone(at + i * step, type, f, i === notes.length - 1 ? tail : step * 2.2, vol));
  }

  private noiseHit(at: number, dur: number, type: BiquadFilterType, freq: number, vol: number, q = 1, sweepTo?: number, bus?: GainNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(bus ?? this.sfxBus);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.02);
  }

  private howl(at: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(380, at);
    o.frequency.exponentialRampToValueAtTime(720, at + 0.45);
    o.frequency.exponentialRampToValueAtTime(460, at + 1.6);
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.11, at + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.7);
    o.connect(g).connect(this.sfxBus);
    o.start(at);
    lfo.start(at);
    o.stop(at + 1.8);
    lfo.stop(at + 1.8);
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // --- music ---------------------------------------------------------------

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    const ctx = this.ctx;
    // Drone: two detuned sines through a slow-breathing lowpass.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const breath = ctx.createOscillator();
    const breathAmt = ctx.createGain();
    breath.frequency.value = 0.07;
    breathAmt.gain.value = 160;
    breath.connect(breathAmt).connect(lp.frequency);
    const dg = ctx.createGain();
    dg.gain.value = 0.035;
    for (const f of [110, 110.6, 164.8]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      this.droneNodes.push(o);
    }
    lp.connect(dg).connect(this.musicBus);
    breath.start();
    // Wind: looping noise through a wandering bandpass.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const gust = ctx.createOscillator();
    const gustAmt = ctx.createGain();
    gust.frequency.value = 0.11;
    gustAmt.gain.value = 260;
    gust.connect(gustAmt).connect(bp.frequency);
    const wg = ctx.createGain();
    wg.gain.value = 0.03;
    wind.connect(bp).connect(wg).connect(this.musicBus);
    wind.start();
    gust.start();
    this.droneNodes.push(breath, wind, gust);

    this.nextNoteAt = ctx.currentTime + 1;
    this.musicTimer = window.setInterval(() => this.scheduleNotes(), 250);
  }

  /** Pentatonic random-walk melody, ~70 bpm, with rests. */
  private scheduleNotes(): void {
    const ctx = this.ctx;
    if (!ctx || this.suspended || ctx.state !== 'running') return;
    const scale = [220, 247, 277, 330, 370, 440, 494, 554, 659, 740];
    while (this.nextNoteAt < ctx.currentTime + 0.6) {
      const beat = 60 / 70 / 2;
      if (Math.random() < 0.62) {
        this.melodyIdx = Math.max(0, Math.min(scale.length - 1, this.melodyIdx + Math.round((Math.random() - 0.5) * 4)));
        this.pluck(this.nextNoteAt, scale[this.melodyIdx]);
      }
      this.nextNoteAt += beat * (Math.random() < 0.25 ? 2 : 1);
    }
  }

  private pluck(at: number, freq: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = freq;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, at);
    lp.frequency.exponentialRampToValueAtTime(500, at + 0.6);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.045, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    o.connect(lp).connect(g).connect(this.musicBus);
    o.start(at);
    o.stop(at + 1.5);
  }
}

export const audio = new AudioEngine();
