import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatChunk, ChatRequest } from '../types/chat';
import { useChatCompletion } from './useChatCompletion';

vi.mock('../lib/llm', () => ({
  streamChat: vi.fn(),
}));

import { streamChat } from '../lib/llm';

const request: ChatRequest = {
  prompt: 'hi',
  model: 'llama3.2',
  temperature: 0.7,
  jsonMode: false,
};

async function* chunks(items: ChatChunk[]): AsyncGenerator<ChatChunk> {
  for (const item of items) {
    yield item;
  }
}

describe('useChatCompletion', () => {
  it('streams text, usage, and timings', async () => {
    vi.mocked(streamChat).mockImplementation(() =>
      chunks([
        { type: 'delta', text: 'Hel' },
        { type: 'delta', text: 'lo' },
        {
          type: 'usage',
          usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
        },
      ]),
    );

    const { result } = renderHook(() => useChatCompletion());

    let completion;
    await act(async () => {
      completion = await result.current.run(request);
    });

    expect(result.current.text).toBe('Hello');
    expect(result.current.status).toBe('idle');
    expect(result.current.usage).toEqual({
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
    });
    expect(result.current.firstTokenMs).toEqual(expect.any(Number));
    expect(completion).toMatchObject({
      text: 'Hello',
      error: null,
      aborted: false,
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
    });
  });

  it('surfaces a provider error', async () => {
    vi.mocked(streamChat).mockImplementation(() =>
      chunks([{ type: 'error', message: 'Model not found' }]),
    );

    const { result } = renderHook(() => useChatCompletion());

    let completion;
    await act(async () => {
      completion = await result.current.run(request);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Model not found');
    expect(completion).toMatchObject({
      error: 'Model not found',
      aborted: false,
    });
  });

  it('marks an aborted run', async () => {
    vi.mocked(streamChat).mockImplementation(async function* (_req, signal) {
      yield { type: 'delta', text: 'Hi' };
      await new Promise<never>((_resolve, reject) => {
        const fail = () => reject(new DOMException('Aborted', 'AbortError'));
        if (signal?.aborted) {
          fail();
          return;
        }
        signal?.addEventListener('abort', fail);
      });
    });

    const { result } = renderHook(() => useChatCompletion());

    let pending: ReturnType<typeof result.current.run>;
    act(() => {
      pending = result.current.run(request);
    });

    await vi.waitFor(() => {
      expect(result.current.text).toBe('Hi');
    });

    let completion;
    await act(async () => {
      result.current.stop();
      completion = await pending;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.text).toBe('Hi');
    expect(completion).toMatchObject({ aborted: true, error: null });
  });
});
