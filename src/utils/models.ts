export const MODELS = [
  { id: 'llama3.2', label: 'Llama 3.2', detail: 'Fast · 3B' },
  { id: 'gemma3:4b', label: 'Gemma 3', detail: 'Google · 4B' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5', detail: 'Stronger · 7B' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export function modelLabel(id: string): string {
  return MODELS.find((option) => option.id === id)?.label ?? id;
}
