import { describe, expect, it } from 'vitest';
import {
  formatContextUsage,
  formatCount,
  formatMaxTokens,
  formatMs,
  formatOutput,
  formatScore,
} from './format';

describe('formatMs', () => {
  it('shows an em dash when empty', () => {
    expect(formatMs(null)).toBe('—');
  });

  it('appends ms', () => {
    expect(formatMs(120)).toBe('120 ms');
  });
});

describe('formatCount', () => {
  it('shows an em dash when empty', () => {
    expect(formatCount(null)).toBe('—');
  });

  it('stringifies a count', () => {
    expect(formatCount(30)).toBe('30');
  });
});

describe('formatMaxTokens', () => {
  it('labels zero as no limit', () => {
    expect(formatMaxTokens(0)).toBe('No limit');
  });

  it('shows a positive cap', () => {
    expect(formatMaxTokens(256)).toBe('256');
  });
});

describe('formatContextUsage', () => {
  it('shows percent and token counts', () => {
    expect(formatContextUsage(12, 1240, 131072)).toBe('12% · 1240 / 131072');
  });
});

describe('formatScore', () => {
  it('shows two decimal places', () => {
    expect(formatScore(0.7)).toBe('0.70');
    expect(formatScore(0.4)).toBe('0.40');
  });
});

describe('formatOutput', () => {
  it('returns plain text when JSON mode is off', () => {
    expect(formatOutput('{"a":1}', false)).toBe('{"a":1}');
  });

  it('pretty-prints valid JSON', () => {
    expect(formatOutput('{"a":1}', true)).toBe('{\n  "a": 1\n}');
  });

  it('returns the raw string when JSON is invalid', () => {
    expect(formatOutput('not-json', true)).toBe('not-json');
  });
});
