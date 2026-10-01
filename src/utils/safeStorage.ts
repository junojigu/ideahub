/**
 * Safe LocalStorage Wrapper with in-memory fallback
 * Prevents DOMException / SecurityError crashes in sandboxed iframes (e.g. AI Studio preview)
 */

const memoryFallback = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return memoryFallback.get(key) ?? null;
      }
      return window.localStorage.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        memoryFallback.set(key, value);
        return;
      }
      window.localStorage.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        memoryFallback.delete(key);
        return;
      }
      window.localStorage.removeItem(key);
    } catch {
      memoryFallback.delete(key);
    }
  },
};
