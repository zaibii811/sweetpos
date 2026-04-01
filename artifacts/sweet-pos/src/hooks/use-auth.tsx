import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useGetMe, useLogin, useLogout, Staff } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: Staff | null | undefined;
  isLoading: boolean;
  login: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
    }
  });
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const login = async (pin: string) => {
    try {
      await loginMutation.mutateAsync({ data: { pin } });
      window.location.href = "/"; // Force refresh to re-fetch me
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Invalid PIN", variant: "destructive" });
      throw e;
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync({});
      window.location.href = "/login";
    } catch (e: any) {
      toast({ title: "Logout failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AuthContext.Provider value={{ user: error ? null : user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
