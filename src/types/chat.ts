export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
  kind?: 'summary';
};

export type ChatRequest = {
  prompt: string;
  model: string;
  temperature: number;
  jsonMode: boolean;
  systemPrompt?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatChunk =
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'error'; message: string };

export type CompareSide = 'left' | 'right';

export type CompareChunk =
  (ChatChunk & { side: CompareSide }) | { side: CompareSide; type: 'closed' };

export type CompletionStatus = 'idle' | 'running' | 'error';

export type CompletionResult = {
  text: string;
  firstTokenMs: number | null;
  totalMs: number;
  usage: TokenUsage | null;
  error: string | null;
  aborted: boolean;
};

export type RunRecord = {
  id: string;
  model: string;
  prompt: string;
  systemPrompt: string;
  temperature: number;
  jsonMode: boolean;
  maxTokens: number | null;
  firstTokenMs: number | null;
  totalMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
};
