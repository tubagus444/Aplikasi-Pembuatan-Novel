import { AIRenderParams } from "./types";
import { ErrorService } from "../errorService";
import { classifyError, getErrorMessage } from "./errors";

const MAX_PROXY_HISTORY = 8;

export async function callProxy(provider: string, params: AIRenderParams, apiKey?: string): Promise<string> {
  const history = (params.history || []).slice(-MAX_PROXY_HISTORY);
  
  const body: any = {
    model: params.model || getModelForProvider(provider),
  };

  if (provider === 'claude') {
    body.temperature = params.temperature || 0.7;
    body.max_tokens = params.maxTokens || 4000;
    body.system = params.systemInstruction;
    body.messages = [
      ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
      { role: "user", content: params.userPrompt }
    ];
  } else if (provider === 'google') {
    body.systemInstruction = {
      parts: [{ text: params.systemInstruction }]
    };
    body.contents = [
      ...history.map(h => ({ 
        role: h.role === 'model' ? 'model' : 'user', 
        parts: [{ text: h.parts[0].text }] 
      })),
      { role: "user", parts: [{ text: params.userPrompt }] }
    ];
    body.generationConfig = {
      temperature: params.temperature || 0.7,
      maxOutputTokens: params.maxTokens || 4000,
    };
  } else {
    body.temperature = params.temperature || 0.7;
    body.max_tokens = params.maxTokens || 4000;
    body.messages = [
      { role: "system", content: params.systemInstruction },
      ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
      { role: "user", content: params.userPrompt }
    ];
  }

  const response = await fetch('/api/ai/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      provider,
      body,
      headers: apiKey ? (
        provider === 'claude' ? { 'x-api-key': apiKey } : 
        provider === 'google' ? { 'x-api-key': apiKey } :
        { 'Authorization': `Bearer ${apiKey}` }
      ) : {}
    }),
    signal: params.signal
  }).catch(networkError => {
    ErrorService.log({
      message: networkError.message,
      type: 'error',
      source: `AI-Proxy (${provider})`,
      metadata: { networkError: true, provider }
    });
    throw networkError;
  });

  if (!response.ok) {
    const errorText = await response.text();
    let rawMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      rawMessage = parsed.error?.message || parsed.message || errorText;
    } catch (e) {
      // Not JSON, use raw text
    }
    
    const code = classifyError(response.status, rawMessage);
    const friendlyMessage = getErrorMessage(code, provider);
    
    const err = new Error(friendlyMessage) as any;
    err.code = code;
    err.provider = provider;
    err.rawMessage = rawMessage;
    throw err;
  }

  const data = await response.json();
  
  if (provider === 'claude') return data.content[0].text;
  if (provider === 'google') {
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      return data.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid response from Google Proxy');
  }
  return data.choices[0].message.content;
}

function getModelForProvider(provider: string) {
  switch (provider) {
    case 'groq': return 'llama-3.3-70b-versatile';
    case 'openrouter': return 'meta-llama/llama-3.3-70b-instruct:free';
    case 'claude': return 'claude-3-5-sonnet-20241022';
    case 'google': return 'gemini-2.0-flash-exp'; // Using a stable but newer default
    default: return '';
  }
}
