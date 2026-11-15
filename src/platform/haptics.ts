import { settings } from './settings';

export type HapticKind = 'tick' | 'light' | 'medium' | 'heavy' | 'success' | 'warning';

interface CapHaptics {
  impact(o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }): Promise<void>;
  notification(o: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>;
}

/**
 * Haptic feedback on every platform the game runs on:
 *  - Native app (Capacitor): the Haptics plugin, true Taptic Engine strengths.
 *  - iPhone Safari / home-screen app: Safari has no vibration API, but it
 *    plays the system "switch" haptic when a hidden <input type=checkbox switch>
 *    is toggled through its label (iOS 18+). Each toggle is one fixed-strength
 *    tick, so stronger feedback = several ticks in a quick burst.
 *  - Android browsers: navigator.vibrate with patterns.
 */

/** Ticks (iOS) per kind, and the gap between them (ms). */
const IOS_TICKS: Record<HapticKind, number> = { tick: 1, light: 1, medium: 2, heavy: 3, success: 3, warning: 4 };
const IOS_GAP = 55;

/** Android vibration patterns (ms on / off / on ...). */
const VIBRATE: Record<HapticKind, number | number[]> = {
  tick: 12,
  light: 22,
  medium: 45,
  heavy: 80,
  success: [40, 50, 40, 50, 90],
  warning: [90, 60, 90],
};

/** Minimum time between two haptics of the same weight class (ms). */
const MIN_GAP: Record<HapticKind, number> = { tick: 75, light: 90, medium: 140, heavy: 200, success: 250, warning: 300 };

const last: Partial<Record<HapticKind, number>> = {};
let label: HTMLLabelElement | null = null;

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function iosSwitch(): HTMLLabelElement | null {
  if (label) return label;
  if (typeof document === 'undefined' || !document.body) return null;
  const l = document.createElement('label');
  l.setAttribute('aria-hidden', 'true');
  l.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  l.appendChild(input);
  // Keep the toggle's click from reaching the game's own handlers.
  l.addEventListener('click', (e) => e.stopPropagation());
  document.body.appendChild(l);
  label = l;
  return l;
}

function capacitorHaptics(): CapHaptics | undefined {
  return (window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapHaptics } } }).Capacitor?.Plugins?.Haptics;
}

export function haptic(kind: HapticKind): void {
  if (!settings.haptics || typeof window === 'undefined') return;
  const now = performance.now();
  if (now - (last[kind] ?? -1e9) < MIN_GAP[kind]) return;
  last[kind] = now;
  try {
    const cap = capacitorHaptics();
    if (cap) {
      if (kind === 'success') void cap.notification({ type: 'SUCCESS' });
      else if (kind === 'warning') void cap.notification({ type: 'WARNING' });
      else void cap.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      return;
    }
    if (typeof navigator.vibrate === 'function' && !isIOS()) {
      navigator.vibrate(VIBRATE[kind]);
      return;
    }
    if (isIOS()) {
      const l = iosSwitch();
      if (!l) return;
      const n = IOS_TICKS[kind];
      for (let i = 0; i < n; i++) {
        if (i === 0) l.click();
        else window.setTimeout(() => l.click(), i * IOS_GAP);
      }
    }
  } catch {
    /* unsupported: ignore */
  }
}
