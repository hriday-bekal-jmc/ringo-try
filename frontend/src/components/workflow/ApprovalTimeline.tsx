import { ApprovalStep } from '../../hooks/useApplication';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING:  { label: '審査中',    color: 'text-yellow-700 bg-yellow-50 border-yellow-300', dot: 'bg-yellow-400' },
  WAITING:  { label: '順番待ち',  color: 'text-gray-500 bg-gray-50 border-gray-300',       dot: 'bg-gray-300'   },
  APPROVED: { label: '承認済み',  color: 'text-green-700 bg-green-50 border-green-300',    dot: 'bg-green-500'  },
  REJECTED: { label: '却下',      color: 'text-red-700 bg-red-50 border-red-300',          dot: 'bg-red-500'    },
  RETURNED: { label: '差戻し',    color: 'text-orange-700 bg-orange-50 border-orange-300', dot: 'bg-orange-400' },
  SKIPPED:  { label: 'スキップ',  color: 'text-gray-500 bg-gray-50 border-gray-200',       dot: 'bg-gray-400'   },
};

interface Props {
  steps: ApprovalStep[];
  applicationStatus: string;
}

export default function ApprovalTimeline({ steps, applicationStatus }: Props) {
  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        承認フロー
      </h3>

      {/* Draft start node */}
      <TimelineNode label="申請" sublabel="Draft submitted" status="APPROVED" actionAt={null} comment={null} />

      {steps.map((step) => (
        <TimelineNode
          key={step.id}
          label={`Step ${step.step_order}: ${step.approver_name}`}
          sublabel={`承認者 (${step.approver_name})`}
          status={step.status}
          actionAt={step.action_at}
          comment={step.comments}
        />
      ))}

      {applicationStatus === 'PENDING_SETTLEMENT' || applicationStatus === 'SETTLED' ? (
        <TimelineNode
          label="経理処理"
          sublabel="Accounting Settlement"
          status={applicationStatus === 'SETTLED' ? 'APPROVED' : 'PENDING'}
          actionAt={null}
          comment={null}
        />
      ) : null}
    </div>
  );
}

function TimelineNode({
  label,
  sublabel,
  status,
  actionAt,
  comment,
}: {
  label: string;
  sublabel: string;
  status: string;
  actionAt: string | null;
  comment: string | null;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['PENDING'];

  return (
    <div className="flex gap-4 pb-6 relative">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${cfg.dot}`} />
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>

      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
          {actionAt && (
            <span className="text-xs text-gray-400 ml-auto">
              {new Date(actionAt).toLocaleString('ja-JP')}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
        {comment && (
          <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2 border border-gray-200">
            {comment}
          </p>
        )}
      </div>
    </div>
  );
}
