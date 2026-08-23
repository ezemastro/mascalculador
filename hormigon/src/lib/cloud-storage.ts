// Shim de localStorage que persiste en el servidor (SQLite vía /api/storage).
// La app escribe/lee en localStorage como siempre; este shim sincroniza los
// cambios con el backend en segundo plano (debounce + flush al cerrar).
//
// Modo offline: si el backend no responde, degrada al localStorage nativo del
// navegador (sin perder la funcionalidad actual).

type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "clear" | "key" | "length"
>;

const API_URL = "/api/storage";
const FLUSH_DEBOUNCE_MS = 500;

let activeFlush: (() => Promise<void>) | null = null;

function getNativeLocalStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function fetchSnapshot(): Promise<Record<string, string>> {
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`storage snapshot failed: ${res.status}`);
  const data = (await res.json()) as { keys?: Record<string, string> };
  return data.keys || {};
}

function buildShim(
  data: Map<string, string>,
  dirty: { set: Map<string, string>; remove: Set<string> },
  scheduleFlush: () => void,
): StorageLike {
  return {
    getItem(key: string): string | null {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      const stringValue = String(value);
      data.set(key, stringValue);
      dirty.set.set(key, stringValue);
      dirty.remove.delete(key);
      scheduleFlush();
    },
    removeItem(key: string): void {
      if (!data.has(key)) return;
      data.delete(key);
      dirty.remove.add(key);
      dirty.set.delete(key);
      scheduleFlush();
    },
    clear(): void {
      for (const key of data.keys()) {
        dirty.remove.add(key);
        dirty.set.delete(key);
      }
      data.clear();
      scheduleFlush();
    },
    key(index: number): string | null {
      return [...data.keys()][index] ?? null;
    },
    get length(): number {
      return data.size;
    },
  };
}

// Fuerza la sincronización pendiente (usada antes de logout).
export async function flushCloudStorage(): Promise<void> {
  if (activeFlush) await activeFlush();
}

export function installCloudStorage(): Promise<{
  cloud: boolean;
  reason?: string;
}> {
  return new Promise((resolve) => {
    const native = getNativeLocalStorage();
    const data = new Map<string, string>();
    const dirty = { set: new Map<string, string>(), remove: new Set<string>() };
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sendBeacon = () => {
      const body = JSON.stringify({
        set: Object.fromEntries(dirty.set),
        remove: [...dirty.remove],
      });
      navigator.sendBeacon(
        API_URL + "/sync",
        new Blob([body], { type: "application/json" }),
      );
      dirty.set.clear();
      dirty.remove.clear();
    };

    const flush = async () => {
      if (dirty.set.size === 0 && dirty.remove.size === 0) return;
      const body = JSON.stringify({
        set: Object.fromEntries(dirty.set),
        remove: [...dirty.remove],
      });
      try {
        const res = await fetch(API_URL + "/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) throw new Error(`sync failed: ${res.status}`);
        dirty.set.clear();
        dirty.remove.clear();
      } catch {
        // El próximo flush reintenta; los datos quedan en memoria.
      }
    };

    const scheduleFlush = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
    };
    activeFlush = flush;

    const registerBrakeFlush = () => {
      const onHidden = () => {
        if (document.visibilityState === "hidden" && dirty.set.size > 0) {
          sendBeacon();
        }
      };
      document.addEventListener("visibilitychange", onHidden);
      window.addEventListener("pagehide", onHidden);
    };

    const install = () => {
      const shim = Object.freeze(buildShim(data, dirty, scheduleFlush));
      try {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          writable: false,
          value: shim,
        });
      } catch {
        try {
          (window as unknown as { localStorage: StorageLike }).localStorage =
            shim;
        } catch {
          return false;
        }
      }
      return true;
    };

    fetchSnapshot()
      .then((keys) => {
        // Merge por-ausencia: toda key local que el server no tenga (ej. la
        // app corrió offline, o el snapshot del usuario está incompleto) se
        // conserva y se sube. El server manda en caso de conflicto.
        const serverKeys = new Set(Object.keys(keys));
        let local = false;
        if (native) {
          for (let i = 0; i < native.length; i++) {
            const k = native.key(i);
            if (k && !serverKeys.has(k)) {
              const v = native.getItem(k)!;
              data.set(k, v);
              dirty.set.set(k, v);
              local = true;
            }
          }
        }
        for (const [k, v] of Object.entries(keys)) data.set(k, v);
        const ok = install();
        registerBrakeFlush();
        if (local) scheduleFlush();
        resolve({
          cloud: ok,
          reason: ok ? undefined : "defineProperty failed",
        });
      })
      .catch((err: unknown) => {
        // Backend inalcanzable: seguir con localStorage nativo (offline).
        resolve({
          cloud: false,
          reason: err instanceof Error ? err.message : String(err),
        });
      });
  });
}
