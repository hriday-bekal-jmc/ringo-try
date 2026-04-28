import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'date' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

export interface ValidationRule {
  rule: string;
  message: string;
}

export interface TemplateSchemaDef {
  template_name: string;
  fields: FieldDef[];
  validations: ValidationRule[];
}

export interface Template {
  id: string;
  title: string;
  title_en: string;
  pattern_code: string;
  schema_definition: TemplateSchemaDef;
  access_level?: string;
}

export interface ApprovalStep {
  id: string;
  step_order: number;
  approver_id: string;
  approver_name: string;
  status: string;
  comments: string | null;
  action_at: string | null;
}

export interface Application {
  id: string;
  application_number: string;
  status: string;
  version: number;
  template_id: string;
  template_title: string;
  title_en: string;
  form_data: Record<string, unknown>;
  schema_definition: TemplateSchemaDef;
  pattern_code: string;
  applicant_name: string;
  created_at: string;
  updated_at: string;
  steps?: ApprovalStep[];
}

export interface DashboardStats {
  pending_approvals: number;
  active_submissions: number;
  drafts: number;
  monthly_settlements: number;
}

export interface Approver {
  id: string;
  full_name: string;
  role: string;
  email: string;
  department_name: string;
}

export interface InboxItem {
  id: string;
  application_number: string;
  status: string;
  step_status: 'PENDING' | 'RETURNED';
  step_order: number;
  step_created_at: string;
  template_title: string;
  applicant_name: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  receipt_amount: number;
  receipt_date: string;
  vendor_name: string | null;
  drive_file_id: string;
  created_at: string;
}

export interface Settlement {
  id: string;
  application_number: string;
  applicant_name: string;
  template_title: string;
  expected_amount: number;
  actual_amount: number | null;
  currency: string;
  status: string;
  settled_at: string | null;
}

export interface SettlementDetail extends Settlement {
  form_data: Record<string, unknown>;
  receipts: Receipt[];
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/api/dashboard/stats');
      return data;
    },
    staleTime: 5 * 60 * 1000, // SSE invalidates on change; long stale time avoids redundant fetches
  });
}

export function useAvailableTemplates() {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<Template[]>('/api/templates');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTemplate(id: string) {
  return useQuery<Template>({
    queryKey: ['templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Template>(`/api/templates/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useMyApplications(status?: string) {
  return useQuery<Application[]>({
    queryKey: ['applications', 'mine', status],
    queryFn: async () => {
      const { data } = await apiClient.get<Application[]>('/api/applications', {
        params: status ? { status } : {},
      });
      return data;
    },
  });
}

export function useApplication(id: string) {
  return useQuery<Application>({
    queryKey: ['applications', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Application>(`/api/applications/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useApprovers(search?: string, departmentId?: string) {
  return useQuery<Approver[]>({
    queryKey: ['approvers', search, departmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<Approver[]>('/api/applications/approvers', {
        params: { search, departmentId },
      });
      return data;
    },
    enabled: !search || search.length >= 2,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      templateId: string;
      formData: Record<string, unknown>;
      approvers: { approverId: string; stepOrder: number }[];
    }) => {
      const { data } = await apiClient.post<{ id: string; application_number: string }>(
        '/api/applications',
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { templateId: string; formData: Record<string, unknown> }) => {
      const { data } = await apiClient.post<{ id: string; application_number: string }>(
        '/api/applications',
        { ...payload, isDraft: true }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSubmitDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      approvers: { approverId: string; stepOrder: number }[];
      version: number;
      formData?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post(`/api/applications/${payload.id}/submit`, {
        approvers: payload.approvers,
        version: payload.version,
        formData: payload.formData,
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['applications', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['applications', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      formData,
      version,
    }: {
      id: string;
      formData: Record<string, unknown>;
      version: number;
    }) => {
      const { data } = await apiClient.put(`/api/applications/${id}`, { formData, version });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['applications', variables.id] });
    },
  });
}

export function useResubmit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      formData,
      version,
    }: {
      id: string;
      formData: Record<string, unknown>;
      version: number;
    }) => {
      const { data } = await apiClient.post(`/api/applications/${id}/resubmit`, { formData, version });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['applications', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['applications', 'mine'] });
    },
  });
}

export function useApprovalInbox() {
  return useQuery<InboxItem[]>({
    queryKey: ['approvals', 'inbox'],
    queryFn: async () => {
      const { data } = await apiClient.get<InboxItem[]>('/api/applications/approvals/inbox');
      return data;
    },
    staleTime: 5 * 60 * 1000, // SSE invalidates on every inbox change
  });
}

export function useApprovalHistory() {
  return useQuery<InboxItem[]>({
    queryKey: ['approvals', 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get<InboxItem[]>('/api/applications/approvals/history');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWaitingApprovals() {
  return useQuery<InboxItem[]>({
    queryKey: ['approvals', 'waiting'],
    queryFn: async () => {
      const { data } = await apiClient.get<InboxItem[]>('/api/applications/approvals/waiting');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      action,
      comment,
    }: {
      applicationId: string;
      action: 'APPROVE' | 'REJECT' | 'RETURN';
      comment?: string;
    }) => {
      const { data } = await apiClient.post(
        `/api/applications/approvals/${applicationId}/action`,
        { action, comment }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSettlements(status?: string) {
  return useQuery<Settlement[]>({
    queryKey: ['settlements', status],
    queryFn: async () => {
      const { data } = await apiClient.get<Settlement[]>('/api/settlements', {
        params: status ? { status } : {},
      });
      return data;
    },
  });
}

export function useTriggerExport() {
  return useMutation({
    mutationFn: async (params: { status?: string; fromDate?: string; toDate?: string }) => {
      const { data } = await apiClient.post('/api/settlements/export', null, { params });
      return data as { message: string; jobId: string };
    },
  });
}

export function useExportStatus() {
  return useQuery<{ ready: boolean; fileName?: string; rows?: number }>({
    queryKey: ['settlements', 'export-status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/settlements/export/status');
      return data as { ready: boolean; fileName?: string; rows?: number };
    },
    refetchInterval: (query) => (query.state.data?.ready ? false : 10_000),
  });
}

export function useSettlementDetail(id: string | null) {
  return useQuery<SettlementDetail>({
    queryKey: ['settlements', id],
    queryFn: async () => {
      const { data } = await apiClient.get<SettlementDetail>(`/api/settlements/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useAttachReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settlementId,
      receiptAmount,
      receiptDate,
      vendorName,
      driveFileId,
    }: {
      settlementId: string;
      receiptAmount: number;
      receiptDate: string;
      vendorName?: string;
      driveFileId: string;
    }) => {
      const { data } = await apiClient.post(`/api/settlements/${settlementId}/receipts`, {
        receiptAmount,
        receiptDate,
        vendorName,
        driveFileId,
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['settlements', variables.settlementId] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
  });
}

export function useMarkSettled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settlementId: string) => {
      const { data } = await apiClient.post(`/api/settlements/${settlementId}/settle`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
  });
}

export function useGetUploadUrl() {
  return useMutation({
    mutationFn: async ({ fileName, mimeType }: { fileName: string; mimeType: string }) => {
      const { data } = await apiClient.post<{ uploadUrl: string }>('/api/settlements/upload-url', {
        fileName,
        mimeType,
      });
      return data;
    },
  });
}
