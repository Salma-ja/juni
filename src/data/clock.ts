import { useSyncExternalStore } from 'react';

/** Demo clock offset in minutes (0 for real users). Shared so any screen can show the DEMO pill. */
let offset = 0;
const listeners = new Set<() => void>();

export function setClockOffset(minutes: number) {
  if (minutes === offset) return;
  offset = minutes;
  listeners.forEach((fn) => fn());
}

export function useClockOffset() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => offset,
    () => 0,
  );
}

/** "+11 h 40 m" / "-2 h" */
export function formatOffset(minutes: number) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${[h ? `${h} h` : '', m ? `${m} m` : ''].filter(Boolean).join(' ') || '0 m'}`;
}
