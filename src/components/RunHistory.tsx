import { FieldHint } from './FieldHint';
import type { RunRecord } from '../types/chat';
import { formatCount, formatMs } from '../utils/format';
import { modelLabel } from '../utils/models';

export function RunHistory({
  runs,
  selectedId,
  hint,
  onRestore,
}: {
  runs: RunRecord[];
  selectedId: string | null;
  hint: {
    openName: string | null;
    onOpenChange: (name: string | null) => void;
  };
  onRestore: (run: RunRecord) => void;
}) {
  return (
    <table className="runs">
      <thead>
        <tr>
          <th>
            <span className="runs__heading">
              Model
              <FieldHint name="run-model" label="model" {...hint}>
                The model used for that run. Click a row to restore its prompt
                and settings. Latest is at the top.
              </FieldHint>
            </span>
          </th>
          <th>
            <span className="runs__heading">
              First token
              <FieldHint name="first-token" label="first token" {...hint}>
                Time from Run until the first piece of the reply arrives.
              </FieldHint>
            </span>
          </th>
          <th>
            <span className="runs__heading">
              Total
              <FieldHint name="total" label="total time" {...hint}>
                Time from Run until the model finishes (or you press Stop).
              </FieldHint>
            </span>
          </th>
          <th>
            <span className="runs__heading">
              Prompt
              <FieldHint
                name="prompt-tokens"
                align="end"
                label="prompt tokens"
                {...hint}
              >
                How much input the model counted: system prompt, prior turns,
                and your new message.
              </FieldHint>
            </span>
          </th>
          <th>
            <span className="runs__heading">
              Reply
              <FieldHint
                name="completion-tokens"
                align="end"
                label="completion tokens"
                {...hint}
              >
                How long the reply was, in tokens. Roughly the size of the
                generated text.
              </FieldHint>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {runs.length === 0 ? (
          <tr>
            <td className="runs__empty" colSpan={5}>
              Each Run adds a row here. Click a row to load that prompt again.
            </td>
          </tr>
        ) : (
          runs.map((run) => (
            <tr key={run.id}>
              <td>
                <button
                  type="button"
                  className={`runs__restore${selectedId === run.id ? ' runs__restore--active' : ''}`}
                  onClick={() => onRestore(run)}
                >
                  {modelLabel(run.model)}
                </button>
              </td>
              <td>{formatMs(run.firstTokenMs)}</td>
              <td>{formatMs(run.totalMs)}</td>
              <td>{formatCount(run.promptTokens)}</td>
              <td>{formatCount(run.completionTokens)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
