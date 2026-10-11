// Who is signed in (demo: pick a GP) and which server the app talks to.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const KEYS = { server: "bloodline.serverUrl", clinician: "bloodline.clinicianId" };

/** Same machine as the Expo dev server, port 3100, unless the presenter sets a tunnel URL. */
function defaultServerUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3100` : "http://10.0.2.2:3100";
}

/** Adds a scheme if missing: plain http for local/LAN addresses, https for tunnel hostnames. */
export function normaliseServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const local = /^(localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.|\d{1,3}(\.\d{1,3}){3})/i.test(trimmed);
  return `${local ? "http" : "https"}://${trimmed}`;
}

interface Session {
  ready: boolean;
  serverUrl: string;
  clinicianId: string | null;
  setServerUrl: (url: string) => Promise<void>;
  signIn: (clinicianId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServer] = useState(defaultServerUrl());
  const [clinicianId, setClinician] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [server, clinician] = await Promise.all([AsyncStorage.getItem(KEYS.server), AsyncStorage.getItem(KEYS.clinician)]);
      if (server) setServer(server);
      if (clinician) setClinician(clinician);
      setReady(true);
    })();
  }, []);

  const setServerUrl = useCallback(async (url: string) => {
    const value = normaliseServerUrl(url) || defaultServerUrl();
    setServer(value);
    await AsyncStorage.setItem(KEYS.server, value);
  }, []);

  const signIn = useCallback(async (id: string) => {
    setClinician(id);
    await AsyncStorage.setItem(KEYS.clinician, id);
  }, []);

  const signOut = useCallback(async () => {
    setClinician(null);
    await AsyncStorage.removeItem(KEYS.clinician);
  }, []);

  const value = useMemo(() => ({ ready, serverUrl, clinicianId, setServerUrl, signIn, signOut }), [ready, serverUrl, clinicianId, setServerUrl, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
