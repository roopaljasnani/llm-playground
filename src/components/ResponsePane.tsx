import type { CompletionStatus } from '../types/chat';
import { formatOutput } from '../utils/format';

export function ResponsePane({
  title,
  status,
  error,
  text,
  jsonMode,
}: {
  title: string;
  status: CompletionStatus;
  error: string | null;
  text: string;
  jsonMode: boolean;
}) {
  return (
    <div className="response-pane">
      <div className="playground__response-head">
        <h2>{title}</h2>
        {status === 'running' ? (
          <span className="status">Streaming…</span>
        ) : null}
      </div>
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
            : 'Run a prompt to see the model’s reply here.'}
        </p>
      )}
    </div>
  );
}
