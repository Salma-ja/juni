import { useLocalSearchParams } from 'expo-router';

export type Schedule = { date: string; classTime: string };

export const campuses = [
  { id: 'just', code: 'JUST', name: 'Jordan University of Science and Technology', label: 'JUST Main Campus' },
  { id: 'yarmouk', code: 'YU', name: 'Yarmouk University', label: 'Yarmouk University' },
  { id: 'irbid-national', code: 'INU', name: 'Irbid National University', label: 'Irbid National University' },
] as const;

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

const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

type RideParams = Schedule & { campus: string };

export function getSchedule(params: Partial<RideParams> = {}) {
  const defaultParams = { date: tomorrow(), classTime: '08:00' };
  const campus = campuses.find(({ id }) => id === params.campus) ?? campuses[0];
  const selected = params.date && params.classTime ? parseSchedule(params.date, params.classTime) : null;
  const classStart = selected ?? parseSchedule(defaultParams.date, defaultParams.classTime)!;
  const offset = (minutes: number) => new Date(classStart.getTime() + minutes * 60_000);
  const departure = offset(-40);
  return {
    params: { ...(selected ? { date: params.date!, classTime: params.classTime! } : defaultParams), campus: campus.id },
    campus,
    classDate: dateLabel.format(classStart),
    classTime: timeLabel.format(classStart),
    departureDate: dateLabel.format(departure),
    departure: timeLabel.format(departure),
    alternate: timeLabel.format(offset(-30)),
    arrival: timeLabel.format(offset(-8)),
  };
}

export function useRideSchedule() {
  const { date, classTime, campus } = useLocalSearchParams<Partial<RideParams>>();
  return getSchedule({ date, classTime, campus });
}
