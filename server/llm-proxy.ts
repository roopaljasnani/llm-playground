import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { parseChatRequest } from '../src/utils/chatRequest.ts';
import { buildProviderPayload } from '../src/utils/messages.ts';

type ProxyConfig = {
  apiKey: string;
  baseUrl: string;
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
    sendJson(res, 503, {
      error:
        'OPENAI_API_KEY is not set. For local Ollama use OPENAI_API_KEY=ollama. Copy .env.example to .env and restart the dev server.',
    });
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
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(buildProviderPayload(parsed)),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Upstream request failed.';
    const ollamaHint = config.baseUrl.includes('11434')
      ? ' Is Ollama running? Try `ollama serve`.'
      : '';
    sendJson(res, 502, { error: `${message}${ollamaHint}` });
    return;
  }

  if (!upstream.ok) {
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
    sendJson(res, upstream.status, { error: message });
    return;
  }

  if (!upstream.body) {
    sendJson(res, 502, { error: 'Provider returned an empty body.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

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

export function llmProxy(): Plugin {
  const config: ProxyConfig = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
  };

  const middleware = (req: IncomingMessage, res: ServerResponse) => {
    void handleChat(req, res, config);
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
      server.middlewares.use('/api/chat', middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/chat', middleware);
    },
  };
}
