import type { ChatMessage, ChatRequest } from '../types/chat';
import { buildChatMessages } from './messages';

export const CONTEXT_WARN_RATIO = 0.8;
export const MESSAGE_TOKEN_OVERHEAD = 4;
export const SUMMARY_MAX_TOKENS = 512;
export const SUMMARY_PREFIX = 'Summary of earlier conversation:';

export type ContextUsage = {
  tokens: number;
  limit: number;
  percent: number;
  warning: boolean;
  exceeded: boolean;
};

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return Math.ceil(trimmed.length / 4);
}

export function estimatePromptTokens(
  request: Pick<
    ChatRequest,
    'prompt' | 'systemPrompt' | 'jsonMode' | 'messages'
  >,
): number {
  return buildChatMessages(request).reduce(
    (sum, message) =>
      sum + estimateTokens(message.content) + MESSAGE_TOKEN_OVERHEAD,
    0,
  );
}

export function contextUsage(tokens: number, limit: number): ContextUsage {
  const safeLimit = Math.max(limit, 1);
  const percent = Math.round((tokens / safeLimit) * 100);
  return {
    tokens,
    limit: safeLimit,
    percent,
    warning: percent >= CONTEXT_WARN_RATIO * 100,
    exceeded: tokens >= safeLimit,
  };
}

export function splitThreadForSummary(messages: ChatMessage[]): {
  older: ChatMessage[];
  recent: ChatMessage[];
} {
  if (messages.length === 0) {
    return { older: [], recent: [] };
  }

  let recentStart = messages.length - 1;
  if (messages[recentStart]?.role === 'assistant' && recentStart > 0) {
    recentStart -= 1;
  }

  if (recentStart === 0) {
    return { older: [...messages], recent: [] };
  }

  return {
    older: messages.slice(0, recentStart),
    recent: messages.slice(recentStart),
  };
}

export function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const speaker =
        message.kind === 'summary'
          ? 'Summary'
          : message.role === 'user'
            ? 'User'
            : 'Assistant';
      return `${speaker}: ${message.content}`;
    })
    .join('\n\n');
}

export function buildSummaryRequest(
  older: ChatMessage[],
  model: string,
): ChatRequest {
  return {
    model,
    temperature: 0.2,
    jsonMode: false,
    maxTokens: SUMMARY_MAX_TOKENS,
    systemPrompt:
      'You compress conversation history. Write a concise summary that keeps facts, decisions, names, constraints, and open questions. Do not answer the user. Do not add a greeting.',
    prompt: `Summarize this conversation so far:\n\n${formatTranscript(older)}`,
  };
}

export function applyConversationSummary(
  summary: string,
  recent: ChatMessage[],
): ChatMessage[] {
  const text = summary.trim();
  if (!text) {
    return recent;
  }

  return [
    {
      role: 'assistant',
      kind: 'summary',
      content: `${SUMMARY_PREFIX}\n\n${text}`,
    },
    ...recent,
  ];
}
