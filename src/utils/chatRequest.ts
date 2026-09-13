import type { ChatMessage, ChatRequest } from '../types/chat.ts';

export const MAX_TOKENS_LIMIT = 8192;
export const MAX_TEMPERATURE = 1;

function parseHistory(value: unknown): ChatMessage[] | string {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return 'messages must be an array.';
  }

  const messages: ChatMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      return 'Each message must be an object.';
    }

    const entry = item as Record<string, unknown>;
    const role = entry.role;
    const content =
      typeof entry.content === 'string' ? entry.content.trim() : '';

    if (role !== 'user' && role !== 'assistant') {
      return 'Message roles must be user or assistant.';
    }
    if (!content) {
      return 'Each message needs text.';
    }

    messages.push({ role, content });
  }

  return messages;
}

export function parseChatRequest(raw: string): ChatRequest | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'Request body must be JSON.';
  }

  if (!parsed || typeof parsed !== 'object') {
    return 'Request body must be an object.';
  }

  const body = parsed as Record<string, unknown>;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const temperature =
    typeof body.temperature === 'number' ? body.temperature : Number.NaN;
  const jsonMode = body.jsonMode === true;
  const systemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
  const history = parseHistory(body.messages);

  if (typeof history === 'string') {
    return history;
  }

  if (!prompt) {
    return 'Prompt is required.';
  }
  if (!model) {
    return 'Model is required.';
  }
  if (
    !Number.isFinite(temperature) ||
    temperature < 0 ||
    temperature > MAX_TEMPERATURE
  ) {
    return `Temperature must be a number between 0 and ${MAX_TEMPERATURE}.`;
  }

  let maxTokens: number | undefined;
  if (body.maxTokens !== undefined && body.maxTokens !== null) {
    if (
      typeof body.maxTokens !== 'number' ||
      !Number.isInteger(body.maxTokens) ||
      body.maxTokens < 1 ||
      body.maxTokens > MAX_TOKENS_LIMIT
    ) {
      return `maxTokens must be an integer between 1 and ${MAX_TOKENS_LIMIT}.`;
    }
    maxTokens = body.maxTokens;
  }

  return {
    prompt,
    model,
    temperature,
    jsonMode,
    ...(systemPrompt ? { systemPrompt } : {}),
    ...(history.length ? { messages: history } : {}),
    ...(maxTokens ? { maxTokens } : {}),
  };
}
