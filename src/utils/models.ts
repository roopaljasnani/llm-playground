export const MODELS = [
  {
    id: 'llama3.2',
    label: 'Llama 3.2',
    detail: 'Fast · 3B',
    contextWindow: 131072,
  },
  {
    id: 'gemma3:4b',
    label: 'Gemma 3',
    detail: 'Google · 4B',
    contextWindow: 131072,
  },
  {
    id: 'qwen2.5:7b',
    label: 'Qwen 2.5',
    detail: 'Stronger · 7B',
    contextWindow: 32768,
  },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

const DEFAULT_CONTEXT_WINDOW = 8192;

export function modelLabel(id: string): string {
  return MODELS.find((option) => option.id === id)?.label ?? id;
}

export function modelContextWindow(id: string): number {
  return (
    MODELS.find((option) => option.id === id)?.contextWindow ??
    DEFAULT_CONTEXT_WINDOW
  );
}
