import type { ChatChunk, ChatRequest } from '../types/chat';
import { parseSseData } from '../utils/sse';

export type { ChatChunk, ChatRequest, TokenUsage } from '../types/chat';
export { parseSseData } from '../utils/sse';

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string;
    };
    if (typeof payload.error === 'string') {
      return payload.error;
    }
    if (payload.error?.message) {
      return payload.error.message;
    }
  } catch {
    // fall through
  }
  return `Request failed (${response.status}).`;
}

export async function* streamChat(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    yield { type: 'error', message: await readErrorMessage(response) };
    return;
  }

  if (!response.body) {
    yield { type: 'error', message: 'The server returned an empty response.' };
    return;
  }

  const reader = response.body.getReader();
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

      const parsed = parseSseData(trimmed.slice(5).trim());
      if (parsed === 'done') {
        return;
      }
      if (parsed) {
        yield parsed;
      }
    }
  }
}
