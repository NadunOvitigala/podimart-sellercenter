import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setAuthToken, getStoredToken } from "./api";
import {
  cognitoEnabled,
  getCognitoToken,
  signOutCognito,
} from "./cognito";

const LOGIN_AT_KEY = "podimart_seller_login_at";
const SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours

type AuthCtx = {
  token: string | null;
  ready: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({
  token: null,
  ready: false,
  login: () => undefined,
  logout: () => undefined,
});

function readLoginAt(): number | null {
  const raw = localStorage.getItem(LOGIN_AT_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function writeLoginAt(at: number | null) {
  if (at == null) localStorage.removeItem(LOGIN_AT_KEY);
  else localStorage.setItem(LOGIN_AT_KEY, String(at));
}

function sessionExpired(loginAt: number | null): boolean {
  if (loginAt == null) return false;
  return Date.now() - loginAt >= SESSION_MS;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(getStoredToken());
  const [ready, setReady] = useState(!cognitoEnabled);

  function clearSession() {
    if (cognitoEnabled) signOutCognito();
    setAuthToken(null);
    writeLoginAt(null);
    setTok(null);
  }

  function establishSession(next: string, loginAt?: number) {
    const at = loginAt ?? Date.now();
    setAuthToken(next);
    writeLoginAt(at);
    setTok(next);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!cognitoEnabled) {
        const stored = getStoredToken();
        const loginAt = readLoginAt();
        if (stored && sessionExpired(loginAt)) {
          clearSession();
        } else if (stored && loginAt == null) {
          // Existing session before timeout feature: start the 6h clock now.
          writeLoginAt(Date.now());
        }
        if (!cancelled) setReady(true);
        return;
      }

      const next = await getCognitoToken();
      if (cancelled) return;
      if (!next) {
        clearSession();
        setReady(true);
        return;
      }

      const loginAt = readLoginAt();
      if (sessionExpired(loginAt)) {
        clearSession();
      } else {
        establishSession(next, loginAt ?? Date.now());
      }
      setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => {
      if (sessionExpired(readLoginAt())) {
        clearSession();
      }
    }, 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      ready,
      login: (next: string) => {
        establishSession(next);
      },
      logout: () => {
        clearSession();
      },
    }),
    [token, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
