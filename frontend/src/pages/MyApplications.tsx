import { Link } from 'react-router-dom';
import { useMyApplications } from '../hooks/useApplication';
import Header from '../components/common/Header';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:              { label: '下書き',      color: 'bg-gray-100 text-gray-600' },
  PENDING_APPROVAL:   { label: '承認待ち',    color: 'bg-yellow-100 text-yellow-800' },
  APPROVED:           { label: '承認済み',    color: 'bg-emerald-100 text-emerald-800' },
  REJECTED:           { label: '却下',        color: 'bg-red-100 text-red-800' },
  RETURNED:           { label: '差戻し',      color: 'bg-orange-100 text-orange-800' },
  PENDING_SETTLEMENT: { label: '精算待ち',    color: 'bg-blue-100 text-blue-800' },
  SETTLED:            { label: '精算完了',    color: 'bg-emerald-100 text-emerald-700' },
};

function ctaFor(status: string): { label: string; style: string } {
  if (status === 'DRAFT')    return { label: '編集・申請する', style: 'bg-gray-700 text-white hover:bg-gray-800' };
  if (status === 'RETURNED') return { label: '修正・再提出',   style: 'bg-orange-500 text-white hover:bg-orange-600' };
  return { label: '詳細を見る', style: 'border border-warm-300 text-gray-600 hover:bg-warm-50' };
}

export default function MyApplications() {
  const { data: applications, isLoading } = useMyApplications();

  const drafts  = (applications ?? []).filter((a) => a.status === 'DRAFT');
  const others  = (applications ?? []).filter((a) => a.status !== 'DRAFT');

  if (isLoading) return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <Header
        title="申請履歴"
        subtitle={`${applications?.length ?? 0}件`}
        action={
          <Link to="/" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-semibold">
            新規申請
          </Link>
        }
      />

      {applications?.length === 0 && (
        <div className="bg-white rounded-xl border border-warm-200 py-16 text-center text-gray-400 text-sm">
          申請はまだありません。
        </div>
      )}

      {/* ── Drafts section ── */}
      {drafts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gray-400 inline-block" />
            下書き ({drafts.length})
          </h2>
          <div className="space-y-2">
            {drafts.map((app) => {
              const cta = ctaFor(app.status);
              return (
                <div
                  key={app.id}
                  className="bg-white border border-dashed border-warm-300 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-brand-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">{app.application_number}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">
                        下書き
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{app.template_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      保存日: {new Date(app.updated_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Link
                    to={`/applications/${app.id}`}
                    className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${cta.style}`}
                  >
                    {cta.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Submitted applications ── */}
      {others.length > 0 && (
        <div>
          {drafts.length > 0 && (
            <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-brand-600 inline-block" />
              提出済み ({others.length})
            </h2>
          )}
          <div className="space-y-2">
            {others.map((app) => {
              const cfg = STATUS_CONFIG[app.status] ?? { label: app.status, color: 'bg-gray-100 text-gray-600' };
              const cta = ctaFor(app.status);
              const isReturned = app.status === 'RETURNED';

              return (
                <div
                  key={app.id}
                  className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-4 transition-all hover:shadow-sm ${
                    isReturned ? 'border-orange-200 bg-orange-50/30' : 'border-warm-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">{app.application_number}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {isReturned && (
                        <span className="text-xs text-orange-600 font-semibold">← 対応が必要です</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{app.template_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(app.created_at).toLocaleDateString('ja-JP')}
                      {app.updated_at !== app.created_at && (
                        <span className="ml-1 text-gray-300">· 更新: {new Date(app.updated_at).toLocaleDateString('ja-JP')}</span>
                      )}
                    </p>
                  </div>

                  <Link
                    to={`/applications/${app.id}`}
                    className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${cta.style}`}
                  >
                    {cta.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
