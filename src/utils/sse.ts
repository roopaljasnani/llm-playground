import type { ChatChunk, CompareChunk } from '../types/chat.ts';

type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type ProviderChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: ProviderUsage;
  error?: { message?: string } | string;
};

export function parseSseData(data: string): ChatChunk | 'done' | null {
  if (data === '[DONE]') {
    return 'done';
  }

  let payload: ProviderChunk;
  try {
    payload = JSON.parse(data) as ProviderChunk;
  } catch {
    return null;
  }

  if (typeof payload.error === 'string') {
    return { type: 'error', message: payload.error };
  }
  if (payload.error?.message) {
    return { type: 'error', message: payload.error.message };
  }

  const text = payload.choices?.[0]?.delta?.content;
  if (text) {
    return { type: 'delta', text };
  }

  if (payload.usage) {
    return {
      type: 'usage',
      usage: {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      },
    };
  }

  return null;
}

export async function* readSseDataLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      yield trimmed.slice(5).trim();
    }
  }
}

export function parseCompareSseData(
  data: string,
): CompareChunk | 'done' | null {
  if (data === '[DONE]') {
    return 'done';
  }

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.side !== 'left' && record.side !== 'right') {
    return null;
  }

  const side = record.side;

  if (record.type === 'delta' && typeof record.text === 'string') {
    return { side, type: 'delta', text: record.text };
  }

  if (record.type === 'closed') {
    return { side, type: 'closed' };
  }

  if (record.type === 'error' && typeof record.message === 'string') {
    return { side, type: 'error', message: record.message };
  }

  if (
    record.type === 'usage' &&
    record.usage &&
    typeof record.usage === 'object'
  ) {
    const usage = record.usage as Record<string, unknown>;
    if (
      typeof usage.promptTokens === 'number' &&
      typeof usage.completionTokens === 'number' &&
      typeof usage.totalTokens === 'number'
    ) {
      return {
        side,
        type: 'usage',
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
      };
    }
  }

  return null;
}
