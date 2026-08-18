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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(getStoredToken());
  const [ready, setReady] = useState(!cognitoEnabled);

  useEffect(() => {
    if (!cognitoEnabled) {
      setReady(true);
      return;
    }
    void getCognitoToken().then((next) => {
      setAuthToken(next);
      setTok(next);
      setReady(true);
    });
  }, []);

  const value = useMemo(
    () => ({
      token,
      ready,
      login: (next: string) => {
        setAuthToken(next);
        setTok(next);
      },
      logout: () => {
        if (cognitoEnabled) signOutCognito();
        setAuthToken(null);
        setTok(null);
      },
    }),
    [token, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
