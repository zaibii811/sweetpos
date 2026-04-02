import { createContext, useContext, ReactNode, useState, useRef } from "react";
import { useGetMe, useLogin, useLogout, Staff } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: Staff | null | undefined;
  isLoading: boolean;
  isLocked: boolean;
  login: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  passwordLogin: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error, refetch } = useGetMe({
    query: { retry: false }
  });
  const [isLocked, setIsLocked] = useState(false);
  const { toast } = useToast();

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const login = async (pin: string) => {
    try {
      await loginMutation.mutateAsync({ data: { pin } });
      window.location.href = "/";
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Invalid PIN", variant: "destructive" });
      throw e;
    }
  };

  const unlock = async (pin: string) => {
    try {
      await loginMutation.mutateAsync({ data: { pin } });
      setIsLocked(false);
      await refetch();
    } catch (e: any) {
      toast({ title: "Unlock failed", description: "Invalid PIN", variant: "destructive" });
      throw e;
    }
  };

  const passwordLogin = async (username: string, password: string) => {
    try {
      const r = await fetch(`${BASE}/api/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Invalid username or password");
      }
      window.location.href = "/";
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Invalid credentials", variant: "destructive" });
      throw e;
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync({});
      setIsLocked(false);
      window.location.href = "/login";
    } catch (e: any) {
      toast({ title: "Logout failed", description: e.message, variant: "destructive" });
    }
  };

  const lock = () => setIsLocked(true);

  return (
    <AuthContext.Provider value={{
      user: error ? null : user,
      isLoading,
      isLocked,
      login,
      unlock,
      passwordLogin,
      logout,
      lock,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
