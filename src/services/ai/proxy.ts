import { AIRenderParams } from "./types";

export async function callProxy(provider: string, params: AIRenderParams, apiKey?: string): Promise<string> {
  const body: any = {
    model: params.model || getModelForProvider(provider),
  };

  if (provider === 'claude') {
    body.temperature = params.temperature || 0.7;
    body.max_tokens = 4000;
    body.system = params.systemInstruction;
    body.messages = [
      ...(params.history || []).map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
      { role: "user", content: params.userPrompt }
    ];
  } else if (provider === 'google') {
    body.systemInstruction = {
      parts: [{ text: params.systemInstruction }]
    };
    body.contents = [
      ...(params.history || []).map(h => ({ 
        role: h.role === 'model' ? 'model' : 'user', 
        parts: [{ text: h.parts[0].text }] 
      })),
      { role: "user", parts: [{ text: params.userPrompt }] }
    ];
    body.generationConfig = {
      temperature: params.temperature || 0.7,
    };
  } else {
    body.temperature = params.temperature || 0.7;
    body.messages = [
      { role: "system", content: params.systemInstruction },
      ...(params.history || []).map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy AI Error (${provider}): ${errorText}`);
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
    case 'google': return 'gemini-1.5-flash'; // Fixed default model for rest api
    default: return '';
  }
}
