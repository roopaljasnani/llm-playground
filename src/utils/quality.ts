import type { ChatRequest } from '../types/chat';

export const QUALITY_METRICS = [
  'relevance',
  'coherence',
  'helpfulness',
] as const;

export type QualityMetric = (typeof QUALITY_METRICS)[number];

export type QualityScores = Record<QualityMetric, number> & {
  overall: number;
};

export type QualityPhase =
  'idle' | 'scoring' | 'regenerating' | 'ready' | 'error';

export type QualityView = {
  scores: QualityScores | null;
  threshold: number;
  phase: QualityPhase;
  retries: number;
  error: string | null;
};

export const DEFAULT_QUALITY_THRESHOLD = 0.7;
export const MAX_QUALITY_RETRIES = 1;

export const QUALITY_JUDGE_INSTRUCTION =
  'You are a strict evaluator. Score the assistant reply. Respond with a JSON object only. Do not wrap it in markdown.';

export function emptyQuality(threshold: number): QualityView {
  return {
    scores: null,
    threshold,
    phase: 'idle',
    retries: 0,
    error: null,
  };
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return roundScore(Math.min(1, Math.max(0, value)));
}

export function overallScore(
  scores: Pick<QualityScores, QualityMetric>,
): number {
  const total = QUALITY_METRICS.reduce(
    (sum, metric) => sum + scores[metric],
    0,
  );
  return roundScore(total / QUALITY_METRICS.length);
}

export function isBelowThreshold(
  scores: QualityScores,
  threshold: number,
): boolean {
  return scores.overall < threshold;
}

export function shouldRegenerate(
  scores: QualityScores,
  threshold: number,
  retries: number,
  maxRetries = MAX_QUALITY_RETRIES,
): boolean {
  return retries < maxRetries && isBelowThreshold(scores, threshold);
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function parseQualityScores(raw: string): QualityScores | string {
  const payload = extractJsonObject(raw);
  if (!payload || typeof payload !== 'object') {
    return 'Quality judge did not return JSON.';
  }

  const record = payload as Record<string, unknown>;
  const scores = {} as Pick<QualityScores, QualityMetric>;

  for (const metric of QUALITY_METRICS) {
    const value = record[metric];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'Quality judge omitted a metric score.';
    }
    scores[metric] = clampScore(value);
  }

  return {
    ...scores,
    overall: overallScore(scores),
  };
}

export function buildQualityJudgeRequest(
  request: Pick<ChatRequest, 'model' | 'prompt'>,
  reply: string,
): ChatRequest {
  return {
    model: request.model,
    temperature: 0.2,
    jsonMode: true,
    maxTokens: 256,
    systemPrompt: QUALITY_JUDGE_INSTRUCTION,
    prompt: [
      'Score the assistant reply from 0 to 1.',
      '',
      'User message:',
      request.prompt,
      '',
      'Assistant reply:',
      reply,
      '',
      'Metrics:',
      '- relevance: does the reply address the user message?',
      '- coherence: is it internally consistent and well formed?',
      '- helpfulness: is it useful and specific enough?',
      '',
      'Return JSON: {"relevance":0.0,"coherence":0.0,"helpfulness":0.0}',
    ].join('\n'),
  };
}
