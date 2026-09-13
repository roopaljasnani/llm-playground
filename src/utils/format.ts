export function formatMs(value: number | null): string {
  return value === null ? '—' : `${value} ms`;
}

export function formatCount(value: number | null): string {
  return value === null ? '—' : String(value);
}

export function formatMaxTokens(value: number): string {
  return value === 0 ? 'No limit' : String(value);
}

export function formatContextUsage(
  percent: number,
  tokens: number,
  limit: number,
): string {
  return `${percent}% · ${tokens} / ${limit}`;
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}

export function formatOutput(text: string, jsonMode: boolean): string {
  if (!jsonMode) {
    return text;
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
