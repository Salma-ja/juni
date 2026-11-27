import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '@/data/api';
import type { Me } from '@/data/api';
import { setClockOffset } from '@/data/clock';

type AuthState = {
  profile: Me | null;
  ready: boolean;
  canEnter: boolean;
  /** Store a freshly claimed demo session. */
  signInWithToken: (token: string, profile: Me) => Promise<void>;
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
      if (live) setReady(true);
    })();
    return () => {
      live = false;
      api.setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!profile?.isDemo) { setClockOffset(0); return; }
    api.demoSettings().then((res) => { if (res.ok) setClockOffset(res.data.clockOffsetMinutes); });
  }, [profile]);

  const signInWithToken = useCallback(async (token: string, next: Me) => {
    await api.setToken(token);
    setProfile(next);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    await api.setToken(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    profile, ready, canEnter: Boolean(profile?.verified), signInWithToken, signOut,
  }), [profile, ready, signInWithToken, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
