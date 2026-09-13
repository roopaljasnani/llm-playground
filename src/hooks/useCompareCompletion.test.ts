import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, CompareChunk } from '../types/chat';
import { useCompareCompletion } from './useCompareCompletion';

vi.mock('../lib/llm', () => ({
  streamChat: vi.fn(),
  streamCompare: vi.fn(),
}));

import { streamCompare } from '../lib/llm';

const leftRequest: ChatRequest = {
  prompt: 'hi',
  model: 'llama3.2',
  temperature: 0.7,
  jsonMode: false,
};

const rightRequest: ChatRequest = {
  ...leftRequest,
  model: 'gemma3:4b',
};

async function* chunks(items: CompareChunk[]): AsyncGenerator<CompareChunk> {
  for (const item of items) {
    yield item;
  }
}

describe('useCompareCompletion', () => {
  it('fans chunks out to both sides from one stream', async () => {
    vi.mocked(streamCompare).mockImplementation(() =>
      chunks([
        { side: 'left', type: 'delta', text: 'A' },
        { side: 'right', type: 'delta', text: 'B' },
        { side: 'left', type: 'delta', text: 'a' },
        { side: 'left', type: 'closed' },
        { side: 'right', type: 'closed' },
      ]),
    );

    const { result } = renderHook(() => useCompareCompletion());

    let completion: [unknown, unknown] | undefined;
    await act(async () => {
      completion = await result.current.run(leftRequest, rightRequest);
    });

    expect(result.current.left.text).toBe('Aa');
    expect(result.current.right.text).toBe('B');
    expect(completion).toMatchObject([
      { text: 'Aa', aborted: false },
      { text: 'B', aborted: false },
    ]);
  });
});
