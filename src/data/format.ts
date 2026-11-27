const TZ = 'Asia/Amman';

/** Integer fils -> "1.50 JD" (2 decimals when the third is 0) or "1.375 JD". */
/** Integer fils as standard 2-decimal JOD. 1350 → "1.35 JD". Never three decimals. */
export function formatFils(fils: number, unit = true) {
  const text = (Math.round(fils / 10) / 100).toFixed(2);
  return unit ? `${text} JD` : text;
}

const dt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts });

/** "7:20 AM" in Asia/Amman. */
export function formatTime(iso: string | number | Date) {
  return dt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace(/\s?(am|pm)/i, (m) => ` ${m.trim().toUpperCase()}`);
}

/** "Mon, 14 Apr" in Asia/Amman. */
export function formatDate(iso: string | number | Date) {
  return dt({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(',', ',');
}

/** "YYYY-MM-DD" of an instant in Asia/Amman. */
export function ammanDay(iso: string | number | Date) {
  const parts = dt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Instant for a local Asia/Amman wall-clock time (Jordan is UTC+3 all year). */
export function ammanInstant(day: string, hhmm: string) {
  return new Date(`${day}T${hhmm}:00+03:00`);
}

/** "mm:ss" for a number of seconds (clamped at 0). */
export function formatCountdown(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
