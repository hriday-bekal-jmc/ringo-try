import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAvailableTemplates, useDashboardStats, Template } from '../hooks/useApplication';
import { useAuth } from '../context/AuthContext';

// ── Recent tracking (timestamp-based, capped, expires after 30 days) ─────────

interface RecentEntry { id: string; ts: number; }
const RECENT_KEY = 'ringo_recent_templates';
const RECENT_SHOW = 5;           // max shown in the folder
const RECENT_STORE = 20;         // max kept in storage (full history)
const RECENT_MAX_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getRawEntries(): RecentEntry[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

export function recordTemplateVisit(id: string): void {
  const prev = getRawEntries().filter((e) => e.id !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([{ id, ts: Date.now() }, ...prev].slice(0, RECENT_STORE)));
}

function getRecentIds(): string[] {
  const cutoff = Date.now() - RECENT_MAX_MS;
  return getRawEntries()
    .filter((e) => e.ts > cutoff)   // only within last 30 days
    .slice(0, RECENT_SHOW)           // max 5 shown
    .map((e) => e.id);
}

// ── Category ──────────────────────────────────────────────────────────────────

function getCategory(title: string): string {
  if (/経費|精算|支払|交通費|出張/.test(title)) return '経費・精算';
  if (/在宅|休暇|残業|休職|復職/.test(title)) return '勤怠・休暇';
  if (/慶弔|見舞/.test(title)) return '慶弔';
  if (/健保|保険|退職/.test(title)) return '人事・手続き';
  if (/備品|鍵|設備/.test(title)) return '設備・備品';
  return '全社共有';
}

// ── Style map — all class strings are literal so Tailwind includes them ────────

interface CatStyle {
  iconBg: string;
  iconText: string;
  featuredBg: string;   // gradient for big tiles
  overlayBg: string;    // hover overlay for small tiles
  bar: string;          // bottom accent bar on hover
  icon: JSX.Element;
}

const ICONS = {
  currency: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  doc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
};

const CATEGORY_STYLE: Record<string, CatStyle> = {
  '経費・精算': {
    iconBg: 'bg-emerald-100', iconText: 'text-emerald-600',
    featuredBg: 'from-emerald-50 to-white',
    overlayBg: 'bg-emerald-50',
    bar: 'bg-emerald-400',
    icon: ICONS.currency,
  },
  '勤怠・休暇': {
    iconBg: 'bg-blue-100', iconText: 'text-blue-600',
    featuredBg: 'from-blue-50 to-white',
    overlayBg: 'bg-blue-50',
    bar: 'bg-blue-400',
    icon: ICONS.calendar,
  },
  '慶弔': {
    iconBg: 'bg-pink-100', iconText: 'text-pink-600',
    featuredBg: 'from-pink-50 to-white',
    overlayBg: 'bg-pink-50',
    bar: 'bg-pink-400',
    icon: ICONS.heart,
  },
  '人事・手続き': {
    iconBg: 'bg-purple-100', iconText: 'text-purple-600',
    featuredBg: 'from-purple-50 to-white',
    overlayBg: 'bg-purple-50',
    bar: 'bg-purple-400',
    icon: ICONS.user,
  },
  '設備・備品': {
    iconBg: 'bg-orange-100', iconText: 'text-orange-600',
    featuredBg: 'from-orange-50 to-white',
    overlayBg: 'bg-orange-50',
    bar: 'bg-orange-400',
    icon: ICONS.box,
  },
  '全社共有': {
    iconBg: 'bg-brand-100', iconText: 'text-brand-600',
    featuredBg: 'from-brand-50 to-white',
    overlayBg: 'bg-brand-50',
    bar: 'bg-brand-400',
    icon: ICONS.doc,
  },
};

const ACCESS_LABEL: Record<string, { label: string; color: string }> = {
  MUST:   { label: '◎ 必須', color: 'bg-emerald-100 text-emerald-700' },
  SHOULD: { label: '〇 推奨', color: 'bg-blue-100 text-blue-700' },
  COULD:  { label: '△ 任意', color: 'bg-yellow-100 text-yellow-700' },
};

// ── Arrow icon ─────────────────────────────────────────────────────────────────

const ArrowRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <path d="M3 8h10M9 4l4 4-4 4"/>
  </svg>
);

// ── Big (Featured) Tile — used for MUST access forms ─────────────────────────

function FeaturedTile({ t }: { t: Template }) {
  const cat = getCategory(t.title);
  const s = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['全社共有'];

  return (
    <Link
      to={`/apply/${t.id}`}
      onClick={() => recordTemplateVisit(t.id)}
      className={`group relative overflow-hidden rounded-2xl border border-warm-200 bg-gradient-to-br ${s.featuredBg} p-6 flex items-start gap-4 hover:shadow-lg hover:border-transparent transition-all duration-300`}
    >
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all duration-300 pointer-events-none" />

      {/* Bottom accent bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-[3px] ${s.bar} scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-2xl`} />

      {/* Icon */}
      <div className={`w-14 h-14 rounded-2xl ${s.iconBg} ${s.iconText} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300`}>
        <div className="scale-125">{s.icon}</div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <span className={`inline-block text-xs font-bold ${s.iconText} mb-1 tracking-wide`}>◎ 必須</span>
        <h3 className="text-base font-bold text-gray-900 leading-snug">{t.title}</h3>
        {t.title_en && (
          <p className="text-xs text-gray-500 mt-1">{t.title_en}</p>
        )}
      </div>

      {/* CTA */}
      <div className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-bold ${s.iconText} group-hover:gap-2.5 transition-all duration-200 mt-1`}>
        起票
        <ArrowRight />
      </div>
    </Link>
  );
}

// ── Small Tile — used for SHOULD / COULD forms ────────────────────────────────

function SmallTile({ t }: { t: Template }) {
  const cat = getCategory(t.title);
  const s = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['全社共有'];
  const access = ACCESS_LABEL[t.access_level ?? 'SHOULD'];

  return (
    <Link
      to={`/apply/${t.id}`}
      onClick={() => recordTemplateVisit(t.id)}
      className="group relative overflow-hidden rounded-xl border border-warm-200 bg-white flex flex-col hover:shadow-xl hover:border-transparent transition-all duration-300"
    >
      {/* Hover overlay — category tint slides in from top-right */}
      <div className={`absolute inset-0 ${s.overlayBg} opacity-0 group-hover:opacity-60 transition-opacity duration-300 pointer-events-none`} />

      {/* Bottom accent bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${s.bar} scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-xl`} />

      {/* Content */}
      <div className="relative p-5 flex-1 flex flex-col">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${s.iconBg} ${s.iconText} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          {s.icon}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug flex-1">{t.title}</h3>
        {t.title_en && (
          <p className="text-xs text-gray-400 mt-1 truncate">{t.title_en}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-warm-100/70">
          {access ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${access.color}`}>
              {access.label}
            </span>
          ) : (
            <span />
          )}
          <span className={`text-xs font-bold ${s.iconText} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
            新規作成 <ArrowRight />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Folder definitions ────────────────────────────────────────────────────────

interface FolderDef {
  id: string;
  label: string;
  type: 'recent' | 'category';
}

const FOLDERS: FolderDef[] = [
  { id: 'recent',       label: '最近使った申請書', type: 'recent' },
  { id: '全社共有',     label: '全社共有',          type: 'category' },
  { id: '経費・精算',   label: '経費・精算',         type: 'category' },
  { id: '勤怠・休暇',   label: '勤怠・休暇',         type: 'category' },
  { id: '慶弔',         label: '慶弔',              type: 'category' },
  { id: '人事・手続き', label: '人事・手続き',        type: 'category' },
  { id: '設備・備品',   label: '設備・備品',          type: 'category' },
];

// ── Folder Row ────────────────────────────────────────────────────────────────

function FolderRow({ folder, count, onClick }: { folder: FolderDef; count: number; onClick: () => void }) {
  const isRecent = folder.type === 'recent';
  const s = isRecent ? null : (CATEGORY_STYLE[folder.id] ?? null);

  const badgeBg  = isRecent ? 'bg-amber-100 text-amber-700' : `${s?.overlayBg ?? 'bg-blue-50'} ${s?.iconText ?? 'text-blue-700'}`;
  const iconWrap = isRecent ? 'bg-amber-100 text-amber-600' : `${s?.iconBg ?? 'bg-blue-100'} ${s?.iconText ?? 'text-blue-600'}`;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 w-full px-5 py-4 hover:bg-brand-50/40 transition-all text-left group border-b border-warm-100 last:border-0"
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconWrap} group-hover:scale-105 transition-transform duration-200`}>
        {isRecent ? (
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="10" cy="10" r="8"/><polyline points="10 5 10 10 13.5 12"/>
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M2 6a2 2 0 0 1 2-2h3.2l2 2H16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
          </svg>
        )}
      </div>

      {/* Label */}
      <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-brand-700 transition-colors">
        {folder.label}
      </span>

      {/* Count badge */}
      {count > 0 && (
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums ${badgeBg}`}>
          {count}
        </span>
      )}

      {/* Chevron */}
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className="w-3.5 h-3.5 text-warm-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-200">
        <path d="M6 3l5 5-5 5"/>
      </svg>
    </button>
  );
}

// ── Form List Row (inside open folder) ────────────────────────────────────────

function FormListRow({ t }: { t: Template }) {
  const cat = getCategory(t.title);
  const s = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['全社共有'];
  const access = ACCESS_LABEL[t.access_level ?? 'SHOULD'];

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-warm-100 last:border-0 hover:bg-brand-50/30 transition-colors group">
      {/* Category-colored icon */}
      <div className={`w-9 h-9 rounded-xl ${s.iconBg} ${s.iconText} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
        <div className="scale-75">{s.icon}</div>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight group-hover:text-brand-700 transition-colors">{t.title}</p>
        {t.title_en && <p className="text-xs text-gray-400 mt-0.5">{t.title_en}</p>}
      </div>

      {/* Access badge + CTA */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {access && (
          <span className={`hidden sm:inline text-xs px-2.5 py-0.5 rounded-full font-medium ${access.color}`}>
            {access.label}
          </span>
        )}
        <Link
          to={`/apply/${t.id}`}
          onClick={() => recordTemplateVisit(t.id)}
          className="px-4 py-1.5 text-xs font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 active:bg-brand-800 transition-colors whitespace-nowrap shadow-sm"
        >
          起票
        </Link>
      </div>
    </div>
  );
}

// ── Stats Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: number | string; sub?: string; color: string; icon: JSX.Element;
}) {
  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

const ALL_TABS = ['すべて', '経費・精算', '勤怠・休暇', '人事・手続き', '設備・備品', '全社共有', '慶弔'];

export default function Dashboard() {
  const { user } = useAuth();
  const { data: templates, isLoading } = useAvailableTemplates();
  const { data: stats } = useDashboardStats();
  const [activeTab, setActiveTab] = useState('すべて');
  const [selectedFolder, setSelectedFolder] = useState<FolderDef | null>(null);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'おはようございます';
    if (h < 18) return 'こんにちは';
    return 'お疲れ様です';
  })();

  function getFolderTemplates(folder: FolderDef): Template[] {
    if (!templates) return [];
    if (folder.type === 'recent') {
      return getRecentIds().map((id) => templates.find((t) => t.id === id)).filter(Boolean) as Template[];
    }
    return templates.filter((t) => getCategory(t.title) === folder.id);
  }

  const visibleFolders = FOLDERS.filter((f) => getFolderTemplates(f).length > 0);

  const filteredTemplates = (templates ?? []).filter(
    (t) => activeTab === 'すべて' || getCategory(t.title) === activeTab
  );

  // Split into featured (MUST) and regular tiles
  const featuredTiles = filteredTemplates.filter((t) => t.access_level === 'MUST');
  const smallTiles = filteredTemplates.filter((t) => t.access_level !== 'MUST');

  const availableTabs = ALL_TABS.filter(
    (tab) => tab === 'すべて' || (templates ?? []).some((t) => getCategory(t.title) === tab)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Welcome ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}、{user?.full_name?.split(' ')[0] ?? user?.full_name}さん
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="承認待ち" value={stats?.pending_approvals ?? '—'} color="bg-amber-100 text-amber-600"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
        />
        <StatCard label="申請中" value={stats?.active_submissions ?? '—'} color="bg-blue-100 text-blue-600"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard label="今月の精算" value={stats?.monthly_settlements ?? '—'} sub="件" color="bg-emerald-100 text-emerald-600"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <StatCard label="下書き" value={stats?.drafts ?? '—'} color="bg-gray-100 text-gray-500"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
        />
      </div>

      {/* ── Folder navigation ── */}
      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden shadow-sm">
        {selectedFolder ? (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-warm-100 bg-warm-50">
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-brand-600 hover:text-brand-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d="M10 13l-5-5 5-5"/>
                </svg>
                トップ
              </button>
              <span className="text-warm-300 text-xs select-none">/</span>
              <span className="text-xs font-bold text-gray-600">{selectedFolder.label}</span>
              <span className="ml-auto text-xs text-gray-400">
                {getFolderTemplates(selectedFolder).length}件
              </span>
            </div>

            {getFolderTemplates(selectedFolder).length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">申請書がありません</p>
            ) : (
              getFolderTemplates(selectedFolder).map((t) => <FormListRow key={t.id} t={t} />)
            )}
          </>
        ) : (
          <>
            {/* Section header */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-warm-100 bg-warm-50/60">
              <div className="w-1 h-4 rounded-full bg-brand-600" />
              <h2 className="text-xs font-bold text-gray-500 tracking-widest uppercase">フォルダー</h2>
            </div>

            {visibleFolders.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">利用可能な申請書がありません</p>
            ) : (
              visibleFolders.map((f) => (
                <FolderRow
                  key={f.id}
                  folder={f}
                  count={getFolderTemplates(f).length}
                  onClick={() => setSelectedFolder(f)}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* ── Tile grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-800 tracking-wide">申請書を作成する</h2>
          <Link to="/applications" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            申請履歴を見る →
          </Link>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-gray-500 border-warm-200 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`bg-warm-100 rounded-2xl animate-pulse ${i < 2 ? 'h-32' : 'h-40'}`} />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-xl border border-warm-200 py-12 text-center text-gray-400 text-sm">
            このカテゴリには利用可能な申請書がありません
          </div>
        ) : (
          <div className="space-y-4">
            {/* Big tiles (MUST forms) — 2 per row */}
            {featuredTiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {featuredTiles.map((t) => <FeaturedTile key={t.id} t={t} />)}
              </div>
            )}

            {/* Small tiles (SHOULD / COULD) — 4 per row */}
            {smallTiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {smallTiles.map((t) => <SmallTile key={t.id} t={t} />)}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
