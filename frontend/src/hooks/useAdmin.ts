import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'GM' | 'PRESIDENT' | 'ACCOUNTING' | 'ADMIN';

export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE:   '一般社員',
  MANAGER:    '課長',
  GM:         '部長',
  PRESIDENT:  '社長',
  ACCOUNTING: '経理',
  ADMIN:      '管理者',
};

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  department_id: string | null;
  department_name: string | null;
  reports_to: string | null;
  reports_to_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  parent_name: string | null;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  departmentId?: string | null;
  reportsTo?: string | null;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  role?: UserRole;
  departmentId?: string | null;
  isActive?: boolean;
  reportsTo?: string | null;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useAdminUsers(filters?: { departmentId?: string; role?: string; search?: string }) {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUser[]>('/api/admin/users', { params: filters });
      return data;
    },
  });
}

export function useAdminDepartments() {
  return useQuery<Department[]>({
    queryKey: ['admin', 'departments'],
    queryFn: async () => {
      const { data } = await apiClient.get<Department[]>('/api/admin/departments');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await apiClient.post<{ id: string; message: string }>('/api/admin/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...payload }: UpdateUserPayload & { userId: string }) => {
      const { data } = await apiClient.put<{ message: string }>(`/api/admin/users/${userId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data } = await apiClient.put<{ message: string }>(`/api/admin/users/${userId}/password`, { password });
      return data;
    },
  });
}
