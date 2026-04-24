import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthSession {
  authenticated: boolean;
  authEnabled: boolean;
  user?: {
    name: string;
    email: string;
    image: string;
  };
}

interface AuthContextType {
  session: AuthSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  status: "loading",
  signIn: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { credentials: "include", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Session check failed: ${res.status}`);
        return res.json();
      })
      .then((data: AuthSession) => {
        setSession(data);
        if (!data.authEnabled || data.authenticated) {
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("unauthenticated");
      });
    return () => controller.abort();
  }, []);

  const signIn = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setSession(null);
    setStatus("unauthenticated");
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ session, status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
