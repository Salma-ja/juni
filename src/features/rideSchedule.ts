/** Date helpers for the plan screen. Travel times and departures now come from the server (handoff §5.1). */

export function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseSchedule(date: string, classTime: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(classTime)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = classTime.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day &&
    result.getHours() === hour && result.getMinutes() === minute ? result : null;
}
