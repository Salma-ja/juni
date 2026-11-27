/** 10-fils largest-remainder split. The seats always add up to the car. */
export function allocateFares(totalFils, rows) {
  const car = Math.round(totalFils / 10) * 10;
  const units = car / 10;
  const n = rows.length;
  if (!n || !units) return [];
  const sumKm = rows.reduce((sum, row) => sum + row.km, 0) || 1;
  const exact = rows.map((row) => ({
    ...row,
    exact: units * (0.25 / n + 0.75 * (row.km / sumKm)),
    soloFils: Math.round((850 + 195 * row.km) / 50) * 50,
  }));
  const base = exact.map((row) => ({ ...row, base: Math.floor(row.exact), rem: row.exact - Math.floor(row.exact) }));
  const short = units - base.reduce((sum, row) => sum + row.base, 0);
  const ranked = [...base].sort((a, b) => b.rem - a.rem || b.km - a.km || String(a.id).localeCompare(String(b.id)));
  const extra = new Set(ranked.slice(0, Math.max(0, short)).map((row) => row.id));
  return base.map((row) => ({
    id: row.id,
    label: row.label,
    km: row.km,
    you: row.you,
    fareFils: (row.base + (extra.has(row.id) ? 1 : 0)) * 10,
    soloFils: row.soloFils,
  }));
}

export function roadKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 1.35 * 100) / 100;
}
