import { describe, expect, it } from 'vitest';
import { parseSseData } from './sse';

describe('parseSseData', () => {
  it('returns done for the terminal marker', () => {
    expect(parseSseData('[DONE]')).toBe('done');
  });

  it('reads a text delta', () => {
    expect(
      parseSseData(
        JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
      ),
    ).toEqual({ type: 'delta', text: 'Hello' });
  });

  it('reads usage from the final chunk', () => {
    expect(
      parseSseData(
        JSON.stringify({
          usage: {
            prompt_tokens: 12,
            completion_tokens: 4,
            total_tokens: 16,
          },
        }),
      ),
    ).toEqual({
      type: 'usage',
      usage: { promptTokens: 12, completionTokens: 4, totalTokens: 16 },
    });
  });

  it('reads a provider error', () => {
    expect(
      parseSseData(JSON.stringify({ error: { message: 'Model not found' } })),
    ).toEqual({ type: 'error', message: 'Model not found' });
  });

  it('reads a string provider error', () => {
    expect(parseSseData(JSON.stringify({ error: 'quota' }))).toEqual({
      type: 'error',
      message: 'quota',
    });
  });

  it('ignores keep-alives and empty deltas', () => {
    expect(parseSseData('not-json')).toBeNull();
    expect(
      parseSseData(JSON.stringify({ choices: [{ delta: {} }] })),
    ).toBeNull();
  });
});
