import type { CompletionStatus } from '../types/chat';
import type { QualityView } from '../utils/quality';
import { formatOutput, formatScore } from '../utils/format';
import { QualityMeter } from './QualityMeter';

export function ResponsePane({
  title,
  status,
  error,
  text,
  jsonMode,
  quality,
  onStop,
}: {
  title: string;
  status: CompletionStatus;
  error: string | null;
  text: string;
  jsonMode: boolean;
  quality?: QualityView;
  onStop?: () => void;
}) {
  const busy =
    status === 'running' ||
    quality?.phase === 'scoring' ||
    quality?.phase === 'regenerating';

  const statusLabel =
    quality?.phase === 'regenerating' && quality.scores
      ? `Quality ${formatScore(quality.scores.overall)} — regenerating`
      : quality?.phase === 'scoring'
        ? 'Scoring…'
        : status === 'running'
          ? 'Streaming…'
          : null;

  return (
    <div className="response-pane">
      <div className="playground__response-head">
        <h2>{title}</h2>
        {busy ? (
          <span className="playground__response-actions">
            {statusLabel ? <span className="status">{statusLabel}</span> : null}
            {onStop ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={onStop}
              >
                Stop
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {quality ? <QualityMeter quality={quality} /> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {text ? (
        <pre>
          <code>{formatOutput(text, jsonMode)}</code>
        </pre>
      ) : (
        <p className="playground__empty">
          {status === 'running'
            ? 'Waiting for the first token…'
            : quality?.phase === 'scoring'
              ? 'Scoring the reply…'
              : 'Run a prompt to see the model’s reply here.'}
        </p>
      )}
    </div>
  );
}
