import { create } from "zustand";
import { api } from "@/lib/api";
import type { LoginResponse, RegisterResponse, User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem("accessToken"),
  isAuthenticated: !!localStorage.getItem("accessToken"),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<LoginResponse>("/auth/login/", {
        email,
        password,
      });
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      set({ accessToken: data.access, isAuthenticated: true });
      // Fetch user profile
      const user = await api.get<User>("/auth/me/");
      set({ user });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (fullName, email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<RegisterResponse>("/auth/register/", {
        full_name: fullName,
        email,
        password,
      });
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      set({
        user: data.user,
        accessToken: data.access_token,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const user = await api.get<User>("/auth/me/");
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  },
}));
