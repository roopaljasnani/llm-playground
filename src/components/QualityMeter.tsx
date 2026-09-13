import type { QualityView } from '../utils/quality';
import { isBelowThreshold } from '../utils/quality';
import { formatScore } from '../utils/format';

export function QualityMeter({ quality }: { quality: QualityView }) {
  if (quality.phase === 'idle' && !quality.scores) {
    return null;
  }

  const scores = quality.scores;
  const below = scores !== null && isBelowThreshold(scores, quality.threshold);
  const tone = quality.phase === 'error' ? 'exceeded' : below ? 'warn' : '';

  return (
    <div
      className={`context-meter quality-meter${tone ? ` context-meter--${tone}` : ''}`}
    >
      {quality.phase === 'scoring' ? <p>Scoring reply…</p> : null}
      {quality.phase === 'regenerating' && scores ? (
        <p>
          Quality {formatScore(scores.overall)} is below{' '}
          {formatScore(quality.threshold)} — regenerating
        </p>
      ) : null}
      {quality.phase === 'error' ? (
        <p>{quality.error ?? 'Could not score this reply.'}</p>
      ) : null}
      {quality.phase === 'ready' && scores ? (
        <div>
          <p>
            Quality {formatScore(scores.overall)} /{' '}
            {formatScore(quality.threshold)}
            {below
              ? quality.retries > 0
                ? ' · still below after retry'
                : ' · below threshold'
              : null}
          </p>
          <p className="quality-meter__metrics">
            Relevance {formatScore(scores.relevance)} · Coherence{' '}
            {formatScore(scores.coherence)} · Helpfulness{' '}
            {formatScore(scores.helpfulness)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
