import { ApiError } from './errors.mjs';

/** Resolve the bearer token to a profile using the given client. Throws NO_SESSION (401). */
export async function requireSession(client, req) {
  const header = req.get('authorization') ?? '';
  const m = /^Bearer\s+([0-9a-fA-F-]{36})$/.exec(header);
  if (!m) throw new ApiError('NO_SESSION', 'Sign in to continue.', 401);
  const { rows } = await client.query(
    `select p.id, p.full_name, p.gender, p.verified, p.is_demo, p.captain_id
       from sessions s join profiles p on p.id = s.profile_id
      where s.token = $1`,
    [m[1].toLowerCase()],
  );
  if (!rows[0]) throw new ApiError('NO_SESSION', 'Sign in to continue.', 401);
  await client.query('update sessions set last_seen_at = now() where token = $1', [m[1].toLowerCase()]);
  return rows[0];
}
