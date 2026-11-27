import { useCallback, useEffect, useState } from 'react';

type Res<T> = { ok: true; data: T } | { ok: false; code: string };

/** Load one async result when deps change. `reload()` refetches without clearing the shown data. */
export function useLoad<T>(load: () => Promise<Res<T>>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; code?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load().then((res) => {
      if (live) setState((s) => (res.ok ? { data: res.data, loading: false } : { data: s.data, code: res.code, loading: false }));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
