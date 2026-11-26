import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const authClient = url && publicKey ? createClient(url, publicKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
}) : null;

const configuredDomains: string = process.env.EXPO_PUBLIC_JUNI_STUDENT_EMAIL_DOMAINS ?? 'ses.yu.edu.jo';
const studentDomains = new Set(configuredDomains
  .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));

export function universityEmail(value: string) {
  const email = value.trim().toLowerCase();
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email);
  return match && studentDomains.has(match[1]) ? email : null;
}

export function displayStudentDomains() {
  return [...studentDomains].map((domain) => `@${domain}`).join(', ');
}

export function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6F0));
}

export function normalizePhone(value: string) {
  const digits = normalizeDigits(value).replace(/[\s().-]/g, '');
  if (/^07\d{8}$/.test(digits)) return `+962${digits.slice(1)}`;
  const international = digits.startsWith('00') ? `+${digits.slice(2)}` : digits;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export function isVerifiedStudent(user: User | null) {
  return Boolean(user?.phone_confirmed_at && user.email_confirmed_at && universityEmail(user.email ?? ''));
}

const AuthContext = createContext<{ user: User | null; ready: boolean; signedOut: boolean }>({
  user: null, ready: false, signedOut: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!authClient);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const client = authClient;
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setSignedOut(true);
      if (session) setSignedOut(false);
      setUser(session?.user ?? null);
      setReady(true);
    });

    if (Platform.OS === 'web') return () => subscription.unsubscribe();

    const refresh = (state: string) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener('change', refresh);
    return () => {
      subscription.unsubscribe();
      listener.remove();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  return <AuthContext.Provider value={{ user, ready, signedOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function studentName(user: User | null) {
  const name = user?.user_metadata.full_name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Student';
}
