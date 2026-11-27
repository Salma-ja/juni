import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { campuses, pickupAreas, type Campus, type PickupArea } from '@/data/api';

type RefSnapshot = { campuses: Campus[]; pickupAreas: PickupArea[] } | null;

let cache: RefSnapshot = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export async function reloadRefData() {
  const [c, p] = await Promise.all([campuses(), pickupAreas()]);
  if (c.ok && p.ok) {
    cache = { campuses: c.data, pickupAreas: p.data };
    emit();
  }
  return cache;
}

export function upsertCachedPickupArea(area: PickupArea) {
  if (!cache) return;
  const rest = cache.pickupAreas.filter((a) => a.id !== area.id);
  cache = {
    ...cache,
    pickupAreas: [area, ...rest],
  };
  emit();
}

export function clearRefDataCache() {
  cache = null;
  emit();
}

/** Campuses and pickup areas (reactive external store so newly saved custom/GPS home locations appear everywhere immediately). */
export function useRefData() {
  const data = useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => cache,
    () => null,
  );

  useEffect(() => {
    if (cache) return;
    reloadRefData().catch(() => {});
  }, []);

  const refresh = useCallback(() => reloadRefData(), []);

  return {
    ready: data !== null,
    campuses: data?.campuses ?? [],
    pickupAreas: data?.pickupAreas ?? [],
    campus: (id?: string | null) => data?.campuses.find((c) => c.id === id),
    pickup: (id?: string | null) => data?.pickupAreas.find((a) => a.id === id),
    refresh,
  };
}
