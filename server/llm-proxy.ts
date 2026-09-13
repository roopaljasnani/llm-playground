import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import type { ChatChunk, ChatRequest, CompareSide } from '../src/types/chat.ts';
import { parseChatRequest } from '../src/utils/chatRequest.ts';
import { buildProviderPayload } from '../src/utils/messages.ts';
import { parseSseData } from '../src/utils/sse.ts';

type ProxyConfig = {
  apiKey: string;
  baseUrl: string;
};

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function ollamaHint(config: ProxyConfig): string {
  return config.baseUrl.includes('11434')
    ? ' Is Ollama running? Try `ollama serve`.'
    : '';
}

function missingKeyError() {
  return {
    error:
      'OPENAI_API_KEY is not set. For local Ollama use OPENAI_API_KEY=ollama. Copy .env.example to .env and restart the dev server.',
  };
}

function writeSse(res: ServerResponse, data: string) {
  if (res.writableEnded) {
    return;
  }
  res.write(`data: ${data}\n\n`);
}

function writeCompareChunk(
  res: ServerResponse,
  side: CompareSide,
  chunk: ChatChunk,
) {
  writeSse(res, JSON.stringify({ side, ...chunk }));
}

async function readUpstreamError(upstream: Response): Promise<string> {
  let message = `Provider returned ${upstream.status}.`;
  try {
    const payload = (await upstream.json()) as {
      error?: { message?: string } | string;
    };
    if (typeof payload.error === 'string') {
      message = payload.error;
    } else if (payload.error?.message) {
      message = payload.error.message;
    }
  } catch {
    // keep the status fallback
  }
  return message;
}

function fetchUpstream(
  config: ProxyConfig,
  request: ChatRequest,
  signal: AbortSignal,
) {
  return fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify(buildProviderPayload(request)),
  });
}

async function pipeTaggedSse(
  body: ReadableStream<Uint8Array>,
  res: ServerResponse,
  side: CompareSide,
) {
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

      const parsed = parseSseData(trimmed.slice(5).trim());
      if (parsed === 'done' || parsed === null) {
        continue;
      }

      writeCompareChunk(res, side, parsed);
    }
  }
}

async function forwardCompareSide(
  upstreamPromise: Promise<Response>,
  res: ServerResponse,
  side: CompareSide,
  signal: AbortSignal,
  hint: string,
) {
  try {
    const upstream = await upstreamPromise;
    if (!upstream.ok) {
      writeCompareChunk(res, side, {
        type: 'error',
        message: await readUpstreamError(upstream),
      });
      return;
    }
    if (!upstream.body) {
      writeCompareChunk(res, side, {
        type: 'error',
        message: 'Provider returned an empty body.',
      });
      return;
    }
    await pipeTaggedSse(upstream.body, res, side);
    writeSse(res, JSON.stringify({ side, type: 'closed' }));
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Upstream request failed.';
    writeCompareChunk(res, side, {
      type: 'error',
      message: `${message}${hint}`,
    });
  }
}

function parseCompareSide(value: unknown, label: string): ChatRequest | string {
  if (!value || typeof value !== 'object') {
    return `${label} must be an object.`;
  }

  const parsed = parseChatRequest(JSON.stringify(value));
  if (typeof parsed === 'string') {
    return `${label}: ${parsed}`;
  }

  return parsed;
}

async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  config: ProxyConfig,
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!config.apiKey) {
    sendJson(res, 503, missingKeyError());
    return;
  }

  const parsed = parseChatRequest(await readBody(req));
  if (typeof parsed === 'string') {
    sendJson(res, 400, { error: parsed });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => {
    controller.abort();
  });

  let upstream: Response;
  try {
    upstream = await fetchUpstream(config, parsed, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Upstream request failed.';
    sendJson(res, 502, { error: `${message}${ollamaHint(config)}` });
    return;
  }

  if (!upstream.ok) {
    sendJson(res, upstream.status, {
      error: await readUpstreamError(upstream),
    });
    return;
  }

  if (!upstream.body) {
    sendJson(res, 502, { error: 'Provider returned an empty body.' });
    return;
  }

  res.writeHead(200, SSE_HEADERS);

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res.write(value);
    }
    res.end();
  } catch {
    res.end();
  }
}

async function handleCompare(
  req: IncomingMessage,
  res: ServerResponse,
  config: ProxyConfig,
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!config.apiKey) {
    sendJson(res, 503, missingKeyError());
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: 'Request body must be JSON.' });
    return;
  }

  if (!body || typeof body !== 'object') {
    sendJson(res, 400, { error: 'Request body must be an object.' });
    return;
  }

  const payload = body as { left?: unknown; right?: unknown };
  const left = parseCompareSide(payload.left, 'left');
  if (typeof left === 'string') {
    sendJson(res, 400, { error: left });
    return;
  }
  const right = parseCompareSide(payload.right, 'right');
  if (typeof right === 'string') {
    sendJson(res, 400, { error: right });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => {
    controller.abort();
  });

  const hint = ollamaHint(config);
  const leftUpstream = fetchUpstream(config, left, controller.signal);
  const rightUpstream = fetchUpstream(config, right, controller.signal);

  res.writeHead(200, SSE_HEADERS);

  try {
    await Promise.all([
      forwardCompareSide(leftUpstream, res, 'left', controller.signal, hint),
      forwardCompareSide(rightUpstream, res, 'right', controller.signal, hint),
    ]);
    writeSse(res, '[DONE]');
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
}

export function llmProxy(): Plugin {
  const config: ProxyConfig = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
  };

  const middleware = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const path = req.url?.split('?')[0];
    if (path === '/api/compare') {
      void handleCompare(req, res, config);
      return;
    }
    if (path === '/api/chat') {
      void handleChat(req, res, config);
      return;
    }
    next();
  };

  return {
    name: 'llm-proxy',
    configResolved(resolved) {
      const env = loadEnv(resolved.mode, resolved.envDir, '');
      config.apiKey = env.OPENAI_API_KEY ?? '';
      config.baseUrl = (
        env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      ).replace(/\/$/, '');
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
