import { describe, expect, it } from 'vitest';
import {
  buildQualityJudgeRequest,
  clampScore,
  isBelowThreshold,
  overallScore,
  parseQualityScores,
  shouldRegenerate,
} from './quality';

describe('clampScore', () => {
  it('keeps values in 0 to 1', () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(2)).toBe(1);
    expect(clampScore(0.456)).toBe(0.46);
  });
});

describe('overallScore', () => {
  it('averages the three metrics', () => {
    expect(
      overallScore({ relevance: 1, coherence: 0.5, helpfulness: 0.4 }),
    ).toBe(0.63);
  });
});

describe('parseQualityScores', () => {
  it('reads JSON scores', () => {
    expect(
      parseQualityScores('{"relevance":0.9,"coherence":0.8,"helpfulness":0.7}'),
    ).toEqual({
      relevance: 0.9,
      coherence: 0.8,
      helpfulness: 0.7,
      overall: 0.8,
    });
  });

  it('reads JSON buried in extra text', () => {
    expect(
      parseQualityScores(
        'Here you go\n```json\n{"relevance":1,"coherence":1,"helpfulness":1}\n```',
      ),
    ).toMatchObject({ overall: 1 });
  });

  it('rejects missing metrics', () => {
    expect(parseQualityScores('{"relevance":1}')).toBe(
      'Quality judge omitted a metric score.',
    );
  });
});

describe('shouldRegenerate', () => {
  const scores = {
    relevance: 0.4,
    coherence: 0.4,
    helpfulness: 0.4,
    overall: 0.4,
  };

  it('retries once when below the threshold', () => {
    expect(shouldRegenerate(scores, 0.7, 0)).toBe(true);
    expect(shouldRegenerate(scores, 0.7, 1)).toBe(false);
    expect(isBelowThreshold({ ...scores, overall: 0.8 }, 0.7)).toBe(false);
  });
});

describe('buildQualityJudgeRequest', () => {
  it('asks the same model for JSON scores', () => {
    const request = buildQualityJudgeRequest(
      { model: 'llama3.2', prompt: 'Hi' },
      'Hello',
    );

    expect(request).toMatchObject({
      model: 'llama3.2',
      jsonMode: true,
      temperature: 0.2,
    });
    expect(request.prompt).toContain('Hi');
    expect(request.prompt).toContain('Hello');
  });
});
