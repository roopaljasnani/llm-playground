import { describe, expect, it } from 'vitest';
import {
  SUMMARY_PREFIX,
  applyConversationSummary,
  contextUsage,
  estimatePromptTokens,
  estimateTokens,
  splitThreadForSummary,
} from './context';

describe('estimateTokens', () => {
  it('treats empty text as zero', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   ')).toBe(0);
  });

  it('uses a 4-characters-per-token estimate', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('estimatePromptTokens', () => {
  it('counts the prompt plus per-message overhead', () => {
    expect(
      estimatePromptTokens({
        prompt: 'abcd',
        jsonMode: false,
      }),
    ).toBe(5);
  });
});

describe('contextUsage', () => {
  it('flags a warning near the limit and exceeded at the limit', () => {
    expect(contextUsage(79, 100)).toMatchObject({
      percent: 79,
      warning: false,
      exceeded: false,
    });
    expect(contextUsage(80, 100)).toMatchObject({
      percent: 80,
      warning: true,
      exceeded: false,
    });
    expect(contextUsage(100, 100)).toMatchObject({
      percent: 100,
      warning: true,
      exceeded: true,
    });
  });
});

describe('splitThreadForSummary', () => {
  it('summarizes a short thread in full', () => {
    const messages = [
      { role: 'user' as const, content: 'Hi' },
      { role: 'assistant' as const, content: 'Hello' },
    ];

    expect(splitThreadForSummary(messages)).toEqual({
      older: messages,
      recent: [],
    });
  });

  it('keeps the latest turn and summarizes the rest', () => {
    const messages = [
      { role: 'user' as const, content: 'one' },
      { role: 'assistant' as const, content: 'two' },
      { role: 'user' as const, content: 'three' },
      { role: 'assistant' as const, content: 'four' },
    ];

    expect(splitThreadForSummary(messages)).toEqual({
      older: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'two' },
      ],
      recent: [
        { role: 'user', content: 'three' },
        { role: 'assistant', content: 'four' },
      ],
    });
  });

  it('keeps a trailing user message as recent', () => {
    const messages = [
      { role: 'user' as const, content: 'one' },
      { role: 'assistant' as const, content: 'two' },
      { role: 'user' as const, content: 'three' },
    ];

    expect(splitThreadForSummary(messages)).toEqual({
      older: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'two' },
      ],
      recent: [{ role: 'user', content: 'three' }],
    });
  });
});

describe('applyConversationSummary', () => {
  it('replaces older turns with a labeled summary', () => {
    expect(
      applyConversationSummary('They discussed shipping.', [
        { role: 'user', content: 'And next?' },
      ]),
    ).toEqual([
      {
        role: 'assistant',
        kind: 'summary',
        content: `${SUMMARY_PREFIX}\n\nThey discussed shipping.`,
      },
      { role: 'user', content: 'And next?' },
    ]);
  });
});
