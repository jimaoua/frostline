import { settings } from './settings';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

interface CapHaptics {
  impact(o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }): Promise<void>;
  notification(o: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>;
}

const VIBRATE_MS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 18,
  heavy: 35,
  success: [12, 40, 18],
  warning: [30, 50, 30],
};

let lastAt = 0;

/**
 * Vibration feedback. Inside the app (Capacitor) this uses the native
 * Haptics plugin (Taptic Engine on iPhone). In a browser it falls back to
 * navigator.vibrate, which works on Android; iPhone Safari has no web
 * vibration, so there it is silent until the game runs as an app.
 */
export function haptic(kind: HapticKind): void {
  if (!settings.haptics) return;
  const now = performance.now();
  if (kind === 'light' && now - lastAt < 70) return;
  lastAt = now;
  const cap = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapHaptics } } }).Capacitor?.Plugins?.Haptics;
  try {
    if (cap) {
      if (kind === 'success') void cap.notification({ type: 'SUCCESS' });
      else if (kind === 'warning') void cap.notification({ type: 'WARNING' });
      else void cap.impact({ style: kind === 'light' ? 'LIGHT' : kind === 'medium' ? 'MEDIUM' : 'HEAVY' });
      return;
    }
    navigator.vibrate?.(VIBRATE_MS[kind]);
  } catch {
    /* unsupported: ignore */
  }
}
