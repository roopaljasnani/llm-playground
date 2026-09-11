import type { ChatChunk } from '../types/chat';

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
