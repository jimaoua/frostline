/**
 * Key-value storage behind one small interface. In the browser this is
 * localStorage; when the game is wrapped as an app (Capacitor), swap the
 * implementation for @capacitor/preferences so iOS never clears saves.
 * Every call is guarded: private browsing or embedded pages can throw.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
