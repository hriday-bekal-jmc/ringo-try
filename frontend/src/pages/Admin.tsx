import { useState } from 'react';
import {
  useAdminUsers,
  useAdminDepartments,
  useCreateUser,
  useUpdateUser,
  useResetPassword,
  AdminUser,
  UserRole,
  ROLE_LABELS,
  CreateUserPayload,
  UpdateUserPayload,
} from '../hooks/useAdmin';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<UserRole, string> = {
  EMPLOYEE:   'bg-gray-100 text-gray-600',
  MANAGER:    'bg-blue-100 text-blue-700',
  GM:         'bg-purple-100 text-purple-700',
  PRESIDENT:  'bg-brand-100 text-brand-700',
  ACCOUNTING: 'bg-emerald-100 text-emerald-700',
  ADMIN:      'bg-red-100 text-red-700',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLOR[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500';

// ── Add / Edit user modal ─────────────────────────────────────────────────────

interface UserFormProps {
  mode: 'add' | 'edit';
  initial?: AdminUser;
  onClose: () => void;
}

function UserFormModal({ mode, initial, onClose }: UserFormProps) {
  const { data: departments } = useAdminDepartments();
  const { data: allUsers } = useAdminUsers();
  const createMutation  = useCreateUser();
  const updateMutation  = useUpdateUser();
  const resetPwMutation = useResetPassword();

  const [fullName,     setFullName]     = useState(initial?.full_name ?? '');
  const [email,        setEmail]        = useState(initial?.email ?? '');
  const [role,         setRole]         = useState<UserRole>(initial?.role ?? 'EMPLOYEE');
  const [departmentId, setDepartmentId] = useState<string>(initial?.department_id ?? '');
  const [reportsTo,    setReportsTo]    = useState<string>(initial?.reports_to ?? '');
  const [isActive,     setIsActive]     = useState<boolean>(initial?.is_active ?? true);
  const [password,     setPassword]     = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');
  const [showResetPw,  setShowResetPw]  = useState(false);
  const [newPw,        setNewPw]        = useState('');
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  const isAdd = mode === 'add';
  const busy  = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isAdd) {
      if (password.length < 8) { setError('パスワードは8文字以上で入力してください。'); return; }
      if (password !== confirmPw) { setError('パスワードが一致しません。'); return; }
      const payload: CreateUserPayload = {
        fullName,
        email,
        password,
        role,
        departmentId: departmentId || null,
        reportsTo:    reportsTo    || null,
      };
      try {
        await createMutation.mutateAsync(payload);
        onClose();
      } catch (err: unknown) {
        setError(extractError(err));
      }
    } else {
      const payload: UpdateUserPayload & { userId: string } = {
        userId: initial!.id,
        fullName,
        email,
        role,
        departmentId: departmentId || null,
        reportsTo:    reportsTo    || null,
        isActive,
      };
      try {
        await updateMutation.mutateAsync(payload);
        setSuccess('ユーザー情報を更新しました。');
        setTimeout(onClose, 800);
      } catch (err: unknown) {
        setError(extractError(err));
      }
    }
  }

  async function handleResetPassword() {
    if (newPw.length < 8) { setError('パスワードは8文字以上で入力してください。'); return; }
    setError('');
    try {
      await resetPwMutation.mutateAsync({ userId: initial!.id, password: newPw });
      setShowResetPw(false);
      setNewPw('');
      setSuccess('パスワードをリセットしました。');
    } catch (err: unknown) {
      setError(extractError(err));
    }
  }

  const managerCandidates = (allUsers ?? []).filter(
    (u) => ['MANAGER', 'GM', 'PRESIDENT'].includes(u.role) && u.id !== initial?.id && u.is_active
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Status toggle — edit only */}
      {!isAdd && (
        <div className="flex items-center justify-between p-3 bg-warm-50 rounded-lg border border-warm-200">
          <span className="text-sm font-semibold text-gray-700">アカウント状態</span>
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isActive ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isActive ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <span className={`text-xs font-semibold ml-2 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
            {isActive ? '有効' : '無効'}
          </span>
        </div>
      )}

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="氏名" required>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="山田 太郎"
            className={inputCls}
          />
        </Field>
        <Field label="メールアドレス" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="yamada@example.com"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="役職" required>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
            {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="部署">
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputCls}>
            <option value="">— 未設定 —</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="上長（直属上司）">
        <select value={reportsTo} onChange={(e) => setReportsTo(e.target.value)} className={inputCls}>
          <option value="">— 未設定 —</option>
          {managerCandidates.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({ROLE_LABELS[u.role]})</option>
          ))}
        </select>
      </Field>

      {/* Password — add mode */}
      {isAdd && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="パスワード" required>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="8文字以上"
              className={inputCls}
            />
          </Field>
          <Field label="パスワード（確認）" required>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              placeholder="再入力"
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {/* Password reset — edit mode */}
      {!isAdd && (
        <div className="border border-warm-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">パスワード</span>
            <button
              type="button"
              onClick={() => setShowResetPw((v) => !v)}
              className="text-xs text-brand-600 hover:text-brand-700 underline"
            >
              {showResetPw ? 'キャンセル' : 'パスワードをリセット'}
            </button>
          </div>
          {showResetPw && (
            <div className="mt-3 flex gap-2 items-end">
              <div className="flex-1">
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="新しいパスワード（8文字以上）"
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPwMutation.isPending}
                className="px-3 py-2 text-xs font-bold bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
              >
                {resetPwMutation.isPending ? '処理中...' : '設定する'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error / success */}
      {error   && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</p>}
      {success && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">{success}</p>}

      {/* Footer buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 border border-warm-300 rounded-lg py-2.5 text-sm text-gray-600 hover:bg-warm-50 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {busy ? '処理中...' : isAdd ? 'ユーザーを追加' : '変更を保存'}
        </button>
      </div>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { error?: string } }; message?: string };
    return e.response?.data?.error ?? e.message ?? 'エラーが発生しました。';
  }
  return 'エラーが発生しました。';
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export default function Admin() {
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [addOpen,      setAddOpen]      = useState(false);
  const [editUser,     setEditUser]     = useState<AdminUser | null>(null);

  const { data: users, isLoading } = useAdminUsers({
    search:       search.length >= 1 ? search : undefined,
    role:         roleFilter   || undefined,
    departmentId: deptFilter   || undefined,
  });
  const { data: departments } = useAdminDepartments();

  const totalActive   = users?.filter((u) => u.is_active).length ?? 0;
  const totalInactive = users?.filter((u) => !u.is_active).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      <Header
        title="ユーザー管理"
        subtitle={`${users?.length ?? 0}名`}
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-semibold"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
            </svg>
            ユーザーを追加
          </button>
        }
      />

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '総ユーザー数',   value: users?.length ?? 0,  color: 'text-gray-700' },
          { label: '有効',           value: totalActive,          color: 'text-emerald-600' },
          { label: '無効',           value: totalInactive,        color: 'text-red-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-warm-200 p-4 text-center">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-1 font-medium">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
            <circle cx="8.5" cy="8.5" r="5.5"/><path d="M15 15l3 3" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="名前・メールで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-warm-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 bg-white"
        >
          <option value="">すべての役職</option>
          {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 bg-white"
        >
          <option value="">すべての部署</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* ── User table ── */}
      {isLoading ? (
        <div className="text-gray-400 py-12 text-center">読み込み中...</div>
      ) : users?.length === 0 ? (
        <div className="bg-white rounded-xl border border-warm-200 py-16 text-center text-sm text-gray-400">
          該当するユーザーが見つかりません。
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 bg-warm-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 tracking-widest uppercase">名前</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 tracking-widest uppercase">役職</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 tracking-widest uppercase">部署</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 tracking-widest uppercase">状態</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 tracking-widest uppercase">登録日</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {users?.map((user) => (
                <tr
                  key={user.id}
                  className={`transition-colors hover:bg-warm-50/50 ${!user.is_active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{user.full_name}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.department_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {user.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditUser(user)}
                      className="text-xs px-3 py-1.5 border border-warm-300 rounded-lg text-gray-600 hover:bg-warm-100 hover:border-warm-400 transition-colors font-semibold"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add user modal ── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="ユーザーを追加">
        <UserFormModal mode="add" onClose={() => setAddOpen(false)} />
      </Modal>

      {/* ── Edit user modal ── */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={editUser ? `${editUser.full_name} を編集` : ''}
      >
        {editUser && (
          <UserFormModal mode="edit" initial={editUser} onClose={() => setEditUser(null)} />
        )}
      </Modal>
    </div>
  );
}
