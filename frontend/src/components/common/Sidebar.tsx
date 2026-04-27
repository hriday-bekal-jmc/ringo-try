import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApprovalInbox } from '../../hooks/useApplication';
import RingoLogo from './RingoLogo';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <rect x="2" y="2" width="6" height="6" rx="1"/><rect x="12" y="2" width="6" height="6" rx="1"/>
      <rect x="2" y="12" width="6" height="6" rx="1"/><rect x="12" y="12" width="6" height="6" rx="1"/>
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <circle cx="10" cy="10" r="8"/><polyline points="10 5 10 10 13.5 12"/>
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <path d="M15 7A5 5 0 0 0 5 7c0 5.5-2.5 7-2.5 7h15s-2.5-1.5-2.5-7"/>
      <path d="M11.4 17a1.5 1.5 0 0 1-2.8 0"/>
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <line x1="10" y1="1" x2="10" y2="19"/>
      <path d="M14 4H8a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H6"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M16.5 10a6.5 6.5 0 0 1-.1 1.1l1.6 1.3-1.5 2.6-2-.7a6.5 6.5 0 0 1-1.9 1.1l-.3 2.1H9.7l-.3-2.1A6.5 6.5 0 0 1 7.5 14.3l-2 .7-1.5-2.6 1.6-1.3A6.5 6.5 0 0 1 5.5 10a6.5 6.5 0 0 1 .1-1.1L4 7.6l1.5-2.6 2 .7A6.5 6.5 0 0 1 9.4 4.6L9.7 2.5h1.6l.3 2.1a6.5 6.5 0 0 1 1.9 1.1l2-.7 1.5 2.6-1.6 1.3a6.5 6.5 0 0 1 .1 1.1z"/>
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/',             label: 'ダッシュボード', roles: null,                                          Icon: IconGrid },
  { to: '/applications', label: '申請履歴',       roles: null,                                          Icon: IconClock },
  { to: '/inbox',        label: '承認受信箱',     roles: ['MANAGER', 'GM', 'PRESIDENT', 'ADMIN'],       Icon: IconBell },
  { to: '/accounting',   label: '経理・精算',     roles: ['ACCOUNTING', 'ADMIN'],                       Icon: IconCurrency },
  { to: '/admin',        label: '管理者設定',     roles: ['ADMIN'],                                     Icon: IconSettings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { data: inbox } = useApprovalInbox();

  const pendingCount = inbox?.length ?? 0;
  const canSeeInbox = user && ['MANAGER', 'GM', 'PRESIDENT', 'ADMIN'].includes(user.role);

  const visible = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <aside className="w-56 flex-shrink-0 bg-brand-900 text-white flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <RingoLogo size={28} color="white" />
        <div>
          <span className="text-sm font-bold tracking-widest text-white">RINGO</span>
          <p className="text-xs text-white/50 leading-none mt-0.5">申請・決裁システム</p>
        </div>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {visible.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                isActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
              }`
            }
          >
            <n.Icon />
            <span className="flex-1">{n.label}</span>
            {n.to === '/inbox' && canSeeInbox && pendingCount > 0 && (
              <span className="text-xs bg-brand-400 text-white font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
        <p className="font-medium text-white/80 truncate">{user?.full_name}</p>
        <p className="truncate">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-2 text-white/50 hover:text-white underline text-xs"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
