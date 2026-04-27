import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<User>('/api/auth/me');
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  async function logout() {
    await apiClient.post('/api/auth/logout');
    queryClient.clear();
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useRequireRole(...roles: string[]): User {
  const { user, isLoading } = useAuth();
  if (!isLoading && (!user || !roles.includes(user.role))) {
    window.location.href = '/';
  }
  return user!;
}
