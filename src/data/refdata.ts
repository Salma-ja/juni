import { useEffect, useState } from 'react';
import { campuses, pickupAreas, type Campus, type PickupArea } from '@/data/api';

let cache: { campuses: Campus[]; pickupAreas: PickupArea[] } | null = null;

/** Campuses and pickup areas (plain selects, cached for the session). */
export function useRefData() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let live = true;
    Promise.all([campuses(), pickupAreas()]).then(([c, p]) => {
      if (!live || !c.ok || !p.ok) return;
      cache = { campuses: c.data, pickupAreas: p.data };
      setData(cache);
    });
    return () => { live = false; };
  }, []);
  return {
    ready: data !== null,
    campuses: data?.campuses ?? [],
    pickupAreas: data?.pickupAreas ?? [],
    campus: (id?: string | null) => data?.campuses.find((c) => c.id === id),
    pickup: (id?: string | null) => data?.pickupAreas.find((a) => a.id === id),
  };
}
