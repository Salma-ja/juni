/** Pickup hotspots and popular Jordan university lecture bells. */

const HOTSPOTS = new Set([
  'hawara',
  'sareeh',
  'university-st',
  'irbid-downtown',
  'sweileh',
  'jubaiha',
]);

export function isHotspot(id?: string | null) {
  return !!id && HOTSPOTS.has(id);
}

/** Class start in Asia/Amman. Arrival target is 10 minutes earlier, matching seeded groups. */
export const classTimeChoices = [
  { time: '08:00', tag: 'Peak bell' },
  { time: '09:00', tag: 'Busy' },
  { time: '10:00', tag: 'Morning' },
  { time: '11:00', tag: 'Midday' },
  { time: '13:00', tag: 'Afternoon' },
] as const;

/** Group arrival (HH:MM in Amman) → label shown on the group card. */
const departureTags: Record<string, string> = {
  '07:45': 'Early bird',
  '07:50': 'Most picked',
  '07:53': 'Express',
  '08:50': 'Busy bell',
};

export function departureMark(iso: string) {
  const hm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
  return departureTags[hm] ?? null;
}
