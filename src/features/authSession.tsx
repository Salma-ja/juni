import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '@/data/api';
import type { Me } from '@/data/api';
import { setClockOffset } from '@/data/clock';
import { reloadRefData } from '@/data/refdata';
import { ensureAccount } from '@/features/accounts';

type AuthState = {
  profile: Me | null;
  ready: boolean;
  canEnter: boolean;
  /** Store a freshly claimed session. */
  signInWithToken: (token: string, profile: Me) => Promise<void>;
  /** Rama or Faris. Each account keeps its own session. */
  switchAccount: (slot: 'rider' | 'driver') => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.setUnauthorizedHandler(() => setProfile(null));
    let live = true;
    (async () => {
      if (await api.loadToken()) {
        const res = await api.me();
        if (live && res.ok) setProfile(res.data);
      }
      if (live && !api.hasToken()) {
        const cfg = await api.config();
        if (live && cfg.ok && cfg.data.demoLoginEnabled) {
          try {
            const session = await ensureAccount('rider');
            if (live) setProfile(session.profile);
          } catch {
            /* stay signed out and show the account picker */
          }
        }
      }
      if (live) setReady(true);
    })();
    return () => {
      live = false;
      api.setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (profile?.profileId) {
      reloadRefData().catch(() => {});
    }
    if (!profile?.isDemo) { setClockOffset(0); return; }
    api.demoSettings().then((res) => { if (res.ok) setClockOffset(res.data.clockOffsetMinutes); });
  }, [profile]);

  const signInWithToken = useCallback(async (token: string, next: Me) => {
    await api.setToken(token);
    setProfile(next);
  }, []);

  const switchAccount = useCallback(async (slot: 'rider' | 'driver') => {
    const session = await ensureAccount(slot);
    setProfile(session.profile);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    await api.setToken(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    profile, ready, canEnter: Boolean(profile?.verified), signInWithToken, switchAccount, signOut,
  }), [profile, ready, signInWithToken, switchAccount, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
