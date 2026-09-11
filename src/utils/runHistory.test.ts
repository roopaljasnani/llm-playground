import { describe, expect, it } from 'vitest';
import type { CompletionResult, RunRecord } from '../types/chat';
import {
  MAX_RUNS,
  createRunRecord,
  prependRun,
  shouldRecordRun,
} from './runHistory';

function run(id: string): RunRecord {
  return {
    id,
    model: 'llama3.2',
    prompt: 'Hi',
    systemPrompt: '',
    temperature: 0.7,
    jsonMode: false,
    maxTokens: null,
    firstTokenMs: 10,
    totalMs: 20,
    promptTokens: 5,
    completionTokens: 2,
  };
}

function result(overrides: Partial<CompletionResult> = {}): CompletionResult {
  return {
    text: 'ok',
    firstTokenMs: 10,
    totalMs: 20,
    usage: null,
    error: null,
    aborted: false,
    ...overrides,
  };
}

describe('shouldRecordRun', () => {
  it('records a successful reply', () => {
    expect(shouldRecordRun(result())).toBe(true);
  });

  it('records a stopped run that already streamed text', () => {
    expect(shouldRecordRun(result({ aborted: true, text: 'ok' }))).toBe(true);
  });

  it('skips a failed run with no text', () => {
    expect(shouldRecordRun(result({ text: '', error: 'offline' }))).toBe(false);
  });
});

describe('createRunRecord', () => {
  it('copies settings from the request', () => {
    expect(
      createRunRecord(
        'r1',
        {
          prompt: 'Hi',
          model: 'gemma3:4b',
          temperature: 0.2,
          jsonMode: true,
          systemPrompt: 'Be brief.',
          maxTokens: 64,
        },
        result({
          usage: { promptTokens: 9, completionTokens: 3, totalTokens: 12 },
        }),
      ),
    ).toEqual({
      id: 'r1',
      model: 'gemma3:4b',
      prompt: 'Hi',
      systemPrompt: 'Be brief.',
      temperature: 0.2,
      jsonMode: true,
      maxTokens: 64,
      firstTokenMs: 10,
      totalMs: 20,
      promptTokens: 9,
      completionTokens: 3,
    });
  });
});

describe('prependRun', () => {
  it('puts the latest run first', () => {
    expect(prependRun([run('a')], run('b')).map((row) => row.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('caps history', () => {
    const current = Array.from({ length: MAX_RUNS }, (_, index) =>
      run(String(index)),
    );

    const next = prependRun(current, run('new'));
    expect(next).toHaveLength(MAX_RUNS);
    expect(next[0]?.id).toBe('new');
    expect(next.at(-1)?.id).toBe(String(MAX_RUNS - 2));
  });
});
