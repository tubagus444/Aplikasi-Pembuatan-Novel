import { AIRenderParams } from '@/src/services/ai/types';
import { ErrorService } from '@/src/services/errorService';
import { classifyError, getErrorMessage } from '@/src/services/ai/errors';

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

  if (params.stream) {
    body.stream = true;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch('/api/ai/proxy', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      provider,
      body
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

  if (params.stream && params.onChunk) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Streaming not supported.");
    
    let completeText = "";
    let buffer = "";
    const decoder = new TextDecoder("utf-8");
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // last incomplete line
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') continue;
        
        try {
          const data = JSON.parse(dataStr);
          let chunk = "";
          
          if (provider === 'claude') {
             if (data.type === 'content_block_delta' && data.delta?.text) {
               chunk = data.delta.text;
             }
          } else if (provider === 'google') {
             if (data.candidates && data.candidates[0]?.content?.parts) {
               chunk = data.candidates[0].content.parts[0].text || "";
             }
          } else {
             if (data.choices && data.choices[0]?.delta?.content) {
               chunk = data.choices[0].delta.content;
             }
          }
          
          if (chunk) {
             completeText += chunk;
             params.onChunk(chunk);
          }
        } catch (e) {
          // Ignore partial parse or unexpected data
        }
      }
    }
    return completeText;
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
    case 'google': return 'gemini-2.0-flash'; // Using the recommended stable model
    default: return '';
  }
}
