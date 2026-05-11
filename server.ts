import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy Layer for AI Calls
  app.post("/api/ai/proxy", async (req, res) => {
    const { provider, body, headers: customHeaders } = req.body;
    
    // Resolve API Key
    let apiKey = '';
    let url = '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    switch (provider) {
      case 'groq':
        apiKey = process.env.GROQ_API_KEY || (customHeaders?.['Authorization']?.replace('Bearer ', '')) || '';
        url = 'https://api.groq.com/openai/v1/chat/completions';
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'openrouter':
        apiKey = process.env.OPENROUTER_API_KEY || (customHeaders?.['Authorization']?.replace('Bearer ', '')) || '';
        url = 'https://openrouter.ai/api/v1/chat/completions';
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'http://localhost:3000';
        headers['X-Title'] = 'AetherScribe IWE';
        break;
      case 'claude':
        apiKey = process.env.CLAUDE_API_KEY || customHeaders?.['x-api-key'] || '';
        url = 'https://api.anthropic.com/v1/messages';
        if (apiKey) headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'google':
        apiKey = process.env.GEMINI_API_KEY || customHeaders?.['x-api-key'] || ''; // Client should send x-api-key for consistency in proxy
        url = `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent?key=${apiKey}`;
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
        body: JSON.stringify(body)
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error(`Proxy error for ${provider}:`, error);
      res.status(500).json({ error: error.message });
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
