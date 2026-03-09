import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  phone: string;
  account_type: 'customer' | 'driver' | 'admin' | 'agent';
  first_name?: string;
  last_name?: string;
  attributes?: any;
}

export interface AuthState {
  user: User | null;
  access_token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access_token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setUser: (user) => set({ user }),
      setAccessToken: (access_token) => set({ access_token }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      logout: () => {
        set({
          user: null,
          access_token: null,
          isAuthenticated: false,
          error: null,
        });
        if (typeof window !== 'undefined') {
          // access_token is handled by persist middleware, but refresh_token is not in the store
          localStorage.removeItem('refresh_token');
        }
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoading = false;
      },
    }
  )
);
