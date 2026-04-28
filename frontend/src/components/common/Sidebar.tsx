import { NavLink, useLocation } from 'react-router-dom';
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

function IconList() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <line x1="4" y1="5" x2="16" y2="5"/><line x1="4" y1="10" x2="16" y2="10"/><line x1="4" y1="15" x2="16" y2="15"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <polyline points="4 10 8 14 16 6"/>
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

function IconHistory() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.5 15a8 8 0 1 0 .5-8.5L1 10"/>
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

// ── NavItem helpers ───────────────────────────────────────────────────────────

interface NavItemProps {
  to: string;
  label: string;
  Icon: React.FC;
  exact?: boolean;
  badge?: number;
  /** Match by pathname + optional search param check */
  matchSearch?: string;
}

function NavItem({ to, label, Icon, exact, badge, matchSearch }: NavItemProps) {
  const location = useLocation();

  const isActive = matchSearch
    ? location.pathname === to.split('?')[0] && location.search.includes(matchSearch)
    : exact
    ? location.pathname === to && !location.search
    : location.pathname.startsWith(to) && !location.search;

  return (
    <NavLink
      to={to}
      className={() =>
        `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
          isActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
        }`
      }
    >
      <Icon />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="text-xs bg-brand-400 text-white font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-bold tracking-widest text-white/40 uppercase">
      {label}
    </p>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { data: inbox } = useApprovalInbox();

  const pendingCount = inbox?.filter((i) => i.step_status === 'PENDING').length ?? 0;
  const isApprover = user && ['MANAGER', 'GM', 'PRESIDENT', 'ADMIN'].includes(user.role);
  const isAccounting = user && ['ACCOUNTING', 'ADMIN'].includes(user.role);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="w-56 flex-shrink-0 bg-brand-900 text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <RingoLogo size={28} color="white" />
        <div>
          <span className="text-sm font-bold tracking-widest text-white">RINGO</span>
          <p className="text-xs text-white/50 leading-none mt-0.5">申請・決裁システム</p>
        </div>
      </div>

      <nav className="flex-1 py-2 px-3 overflow-y-auto">
        {/* Dashboard */}
        <NavItem to="/" label="ダッシュボード" Icon={IconGrid} exact />

        {/* 申請 section */}
        <SectionLabel label="申請" />
        <NavItem to="/applications" label="全ての申請" Icon={IconList} exact />
        <NavItem
          to="/applications?view=results"
          label="申請結果"
          Icon={IconCheck}
          matchSearch="view=results"
        />

        {/* 承認 section — approver roles only */}
        {isApprover && (
          <>
            <SectionLabel label="承認" />
            <NavItem
              to="/inbox?view=all"
              label="全ての承認"
              Icon={IconHistory}
              matchSearch="view=all"
            />
            <NavItem
              to="/inbox"
              label="承認予定"
              Icon={IconBell}
              exact
              badge={pendingCount}
            />
            <NavItem
              to="/inbox?view=waiting"
              label="作業予定"
              Icon={IconClock}
              matchSearch="view=waiting"
            />
          </>
        )}

        {/* 経理 section */}
        {isAccounting && (
          <>
            <SectionLabel label="経理" />
            <NavItem to="/accounting" label="経理・精算" Icon={IconCurrency} />
          </>
        )}

        {/* 管理 section */}
        {isAdmin && (
          <>
            <SectionLabel label="管理" />
            <NavItem to="/admin" label="管理者設定" Icon={IconSettings} />
          </>
        )}
      </nav>

      {/* User footer */}
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
