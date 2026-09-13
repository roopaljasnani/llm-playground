import type { ContextUsage } from '../utils/context';
import { formatContextUsage } from '../utils/format';

export function ContextMeter({
  usage,
  label,
  onSummarize,
  canSummarize = false,
  summarizing = false,
}: {
  usage: ContextUsage;
  label?: string;
  onSummarize?: () => void;
  canSummarize?: boolean;
  summarizing?: boolean;
}) {
  const tone = usage.exceeded ? 'exceeded' : usage.warning ? 'warn' : '';

  return (
    <div className={`context-meter${tone ? ` context-meter--${tone}` : ''}`}>
      <p>
        {label ? `${label} · ` : null}
        Context {formatContextUsage(usage.percent, usage.tokens, usage.limit)}
      </p>
      {canSummarize && onSummarize ? (
        <button
          type="button"
          className="text-button"
          onClick={onSummarize}
          disabled={summarizing}
        >
          {summarizing ? 'Summarizing…' : 'Summarize earlier turns'}
        </button>
      ) : null}
    </div>
  );
}
