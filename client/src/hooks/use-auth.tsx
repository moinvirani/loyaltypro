import { ReactNode, createContext, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SafeBusiness = {
  id: number;
  name: string;
  email: string;
  logo?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  createdAt?: Date | null;
};

type AuthContextType = {
  user: SafeBusiness | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SafeBusiness, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SafeBusiness, Error, RegisterData>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  name: string;
  email: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SafeBusiness | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid email or password");
      }
      return await res.json();
    },
    onSuccess: (user: SafeBusiness) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (newBusiness: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", newBusiness);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create account");
      }
      return await res.json();
    },
    onSuccess: (user: SafeBusiness) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
