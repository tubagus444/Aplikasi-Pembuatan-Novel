import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body bisa besar pada mode caching (full Story Bible + Codex di system prompt).
  // Default Express 100kb akan menolak (413), jadi limit dinaikkan.
  app.use(express.json({ limit: '25mb' }));

  // API Proxy Layer for AI Calls
  app.post("/api/ai/proxy", async (req, res) => {
    // SV2: batalkan permintaan ke provider bila klien memutus koneksi (hemat kuota & resource).
    const upstream = new AbortController();
    res.on('close', () => upstream.abort());

    // SV15: validasi input agar request malformed tidak melempar di luar try.
    // (Express 4 tidak menangkap error async → request bisa menggantung tanpa respons.)
    const { provider, body, ollamaBaseUrl } = req.body || {};
    if (!provider || typeof provider !== 'string' || !body || typeof body !== 'object') {
      return res.status(400).json({ error: "Permintaan tidak valid: 'provider' dan 'body' wajib ada." });
    }

    const clientApiKey = (req.headers['x-api-key'] as string) || '';
    const isStream = !!body.stream;
    
    // Resolve API Key (prioritize client-provided API keys)
    let apiKey = '';
    let url = '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    switch (provider) {
      case 'groq':
        apiKey = clientApiKey || process.env.GROQ_API_KEY || '';
        url = 'https://api.groq.com/openai/v1/chat/completions';
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'openrouter':
        apiKey = clientApiKey || process.env.OPENROUTER_API_KEY || '';
        url = 'https://openrouter.ai/api/v1/chat/completions';
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'http://localhost:3000';
        headers['X-Title'] = 'AetherScribe IWE';
        break;
      case 'claude':
        apiKey = clientApiKey || process.env.CLAUDE_API_KEY || '';
        url = 'https://api.anthropic.com/v1/messages';
        if (apiKey) headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        // Aktifkan prompt caching + TTL diperpanjang (cache_control ttl '1h' pada blok system).
        headers['anthropic-beta'] = 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11';
        break;
      case 'google':
        apiKey = clientApiKey || process.env.GEMINI_API_KEY || '';
        // Ensure model name is correctly formatted for the URL
        const modelName = body.model || 'gemini-2.5-flash';
        const sanitizedModel = modelName.includes('/') ? modelName : `models/${modelName}`;
        if (isStream) {
          url = `https://generativelanguage.googleapis.com/v1beta/${sanitizedModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
          // Gemini doesn't use a 'stream: true' property in the body, it uses the alt=sse url
          delete body.stream;
        } else {
          url = `https://generativelanguage.googleapis.com/v1beta/${sanitizedModel}:generateContent?key=${apiKey}`;
        }
        break;
      case 'ollama':
        // Use Ollama's OpenAI-compatible endpoint so the request body matches other providers.
        url = `${(ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '')}/v1/chat/completions`;
        break;
      default:
        return res.status(400).json({ error: "Unsupported provider" });
    }

    // If API key is still missing, check if it was sent in the request (obfuscated or directly)
    // For now, we prioritize server-side keys.

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: upstream.signal
      });

      if (!response.ok) {
        const errorData = await response.text();
        return res.status(response.status).json({ error: errorData || `HTTP error ${response.status}` });
      }

      if (isStream) {
        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body?.getReader();
        if (!reader) {
          return res.status(500).json({ error: "Streaming not supported by proxy response." });
        }

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
        res.end();
        return;
      }

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      // Klien memutus / kita abort upstream → koneksi sudah tidak ada, jangan kirim apa-apa.
      if (error?.name === 'AbortError') return;
      console.error(`Proxy error for ${provider}:`, error);
      // SV3: bila streaming SSE sudah dimulai, header sudah terkirim → jangan tulis status/JSON lagi.
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.end();
      }
    }
  });

  // Query Allowed Gemini Models from Google API
  app.post("/api/ai/google-models", async (req, res) => {
    const clientApiKey = (req.headers['x-api-key'] as string) || '';
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      return res.status(400).json({ error: "Google API Key is required. Please check that it is entered." });
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error(`Google models listing error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Query Ollama Models
  app.post("/api/ai/ollama-models", async (req, res) => {
    const { baseUrl } = req.body;
    const url = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/tags`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);
    } catch (error: any) {
      console.error(`Ollama models listing error:`, error);
      res.status(500).json({ error: error.message || 'Failed to connect to Ollama. Make sure it is running globally.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
