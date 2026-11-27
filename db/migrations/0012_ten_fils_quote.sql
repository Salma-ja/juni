-- Seat quotes settle in 10-fils steps. The last seat takes the remainder so the car still sums exactly.

create or replace function core.fare_share(p_group_fare int, p_capacity int, p_direct_km numeric[], p_rider_index int,
                                           p_frozen_sum int, p_is_last boolean)
returns int language plpgsql immutable as $$
declare
  mx numeric; mn numeric; s numeric; d numeric; num bigint; den bigint; raw int;
begin
  if p_is_last then
    return p_group_fare - p_frozen_sum;
  end if;
  select max(x), min(x), sum(x) into mx, mn, s from unnest(p_direct_km) x;
  if mx - mn <= 2.0 then
    return (p_group_fare / p_capacity / 10) * 10;
  end if;
  d := p_direct_km[p_rider_index];
  num := p_group_fare::bigint * round((s + 3 * p_capacity * d) * 100)::bigint;
  den := 4::bigint * p_capacity * round(s * 100)::bigint;
  raw := (num / den)::int;
  return (round(raw / 10.0) * 10)::int;
end $$;
