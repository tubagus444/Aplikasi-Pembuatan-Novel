import { AIRenderParams } from '@/src/services/ai/types';
import { ErrorService } from '@/src/services/errorService';
import { classifyError, getErrorMessage } from '@/src/services/ai/errors';
import { db } from '@/src/db';

const MAX_PROXY_HISTORY = 8;
const PROXY_TIMEOUT_MS = 60000; // batas waktu menunggu respons (untuk stream: idle-timeout antar-chunk)

function historyText(h: { role: string; parts: { text: string }[] }): string {
  return h.parts?.[0]?.text ?? '';
}

export async function callProxy(provider: string, params: AIRenderParams, apiKey?: string): Promise<string> {
  const history = (params.history || []).slice(-MAX_PROXY_HISTORY);

  const body: any = {
    model: params.model || getModelForProvider(provider),
  };

  let ollamaBaseUrl: string | undefined = undefined;
  if (provider === 'ollama') {
     ollamaBaseUrl = localStorage.getItem('ollama_base_url') || 'http://localhost:11434';
  }

  if (provider === 'claude') {
    body.temperature = params.temperature || 0.7;
    body.max_tokens = params.maxTokens || 4000;
    body.system = params.systemInstruction;
    body.messages = [
      ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: historyText(h) })),
      { role: "user", content: params.userPrompt }
    ];
  } else if (provider === 'google') {
    body.systemInstruction = {
      parts: [{ text: params.systemInstruction }]
    };
    body.contents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: historyText(h) }]
      })),
      { role: "user", parts: [{ text: params.userPrompt }] }
    ];
    body.generationConfig = {
      temperature: params.temperature || 0.7,
      maxOutputTokens: params.maxTokens || 4000,
    };
  } else {
    // OpenAI Compatible (groq, openrouter, ollama)
    body.temperature = params.temperature || 0.7;
    body.max_tokens = params.maxTokens || 4000;
    body.messages = [
      { role: "system", content: params.systemInstruction },
      ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: historyText(h) })),
      { role: "user", content: params.userPrompt }
    ];
    if (params.stream) {
      body.stream_options = { include_usage: true };
    }
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

  // Timeout internal + teruskan sinyal pembatalan dari pemanggil dalam satu controller gabungan.
  const composite = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout>;
  const armTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { timedOut = true; composite.abort(); }, PROXY_TIMEOUT_MS);
  };
  armTimeout();

  const externalSignal = params.signal;
  const forwardAbort = () => composite.abort();
  if (externalSignal) {
    if (externalSignal.aborted) composite.abort();
    else externalSignal.addEventListener('abort', forwardAbort);
  }
  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
  };
  const timeoutError = () => {
    const err = new Error(getErrorMessage('TIMEOUT', provider)) as any;
    err.code = 'TIMEOUT';
    err.provider = provider;
    return err;
  };

  let response: Response;
  try {
    response = await fetch('/api/ai/proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider, body, ollamaBaseUrl }),
      signal: composite.signal
    });
  } catch (networkError: any) {
    cleanup();
    if (timedOut) throw timeoutError();
    if (networkError?.name === 'AbortError') throw networkError; // dibatalkan oleh pemanggil
    ErrorService.log({
      message: networkError.message,
      type: 'error',
      source: `AI-Proxy (${provider})`,
      metadata: { networkError: true, provider }
    });
    throw networkError;
  }

  if (!response.ok) {
    cleanup();
    const errorText = await response.text();
    const rawMessage = extractErrorMessage(errorText);
    const code = classifyError(response.status, rawMessage);
    const friendlyMessage = getErrorMessage(code, provider);

    const err = new Error(friendlyMessage) as any;
    err.code = code;
    err.provider = provider;
    err.rawMessage = rawMessage;
    throw err;
  }

  try {
    let usageData: any = null;

    if (params.stream && params.onChunk) {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming not supported.");

      let completeText = "";
      let buffer = "";
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armTimeout(); // data mengalir → reset idle-timeout

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

            if (data.usage) usageData = data.usage;
            if (data.usageMetadata) usageData = data.usageMetadata;
            if (data.amazon_bedrock_invocation_metrics) usageData = data.amazon_bedrock_invocation_metrics;

            if (provider === 'claude') {
               // Anthropic SSE: message_start membawa input_tokens, message_delta membawa output_tokens.
               if (data.type === 'message_start' && data.message?.usage) {
                  usageData = { ...usageData, ...data.message.usage };
               }
               if (data.type === 'message_delta' && data.usage) {
                  usageData = { ...usageData, ...data.usage };
               }
               if (data.type === 'message_stop' && data.amazon_bedrock_invocation_metrics) {
                  usageData = data.amazon_bedrock_invocation_metrics;
               }
               if (data.type === 'content_block_delta' && data.delta?.text) {
                 chunk = data.delta.text;
               }
            } else if (provider === 'google') {
               if (data.candidates && data.candidates[0]?.content?.parts) {
                 chunk = data.candidates[0].content.parts[0]?.text || "";
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

      logUsageToDB(params, provider, usageData, completeText);
      return completeText;
    }

    const data = await response.json();
    if (data.usage) usageData = data.usage;
    if (data.usageMetadata) usageData = data.usageMetadata;

    const completeText = extractCompleteText(provider, data);
    if (!completeText) {
      const err = new Error(getErrorMessage('EMPTY_RESPONSE', provider)) as any;
      err.code = 'EMPTY_RESPONSE';
      err.provider = provider;
      err.rawMessage = JSON.stringify(data).slice(0, 500);
      throw err;
    }

    logUsageToDB(params, provider, usageData, completeText);
    return completeText;
  } catch (err: any) {
    if (timedOut) throw timeoutError();
    throw err;
  } finally {
    cleanup();
  }
}

/** Mengambil teks hasil dari berbagai bentuk respons provider dengan aman. */
function extractCompleteText(provider: string, data: any): string {
  if (provider === 'claude') return data?.content?.[0]?.text ?? '';
  if (provider === 'google') return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * server.ts membungkus error provider sebagai { error: "<teks/JSON mentah>" }.
 * Fungsi ini mengupas pembungkus itu untuk mendapatkan pesan asli yang berguna.
 */
function extractErrorMessage(errorText: string): string {
  let inner = errorText;
  try {
    const outer = JSON.parse(errorText);
    if (typeof outer?.error === 'string') inner = outer.error;
    else if (typeof outer?.error?.message === 'string') return outer.error.message;
    else if (typeof outer?.message === 'string') return outer.message;
  } catch {
    return errorText;
  }
  // 'inner' bisa berupa JSON provider asli, mis. {"error":{"message":"..."}}
  try {
    const parsed = JSON.parse(inner);
    return parsed?.error?.message || parsed?.message || inner;
  } catch {
    return inner;
  }
}

function logUsageToDB(params: AIRenderParams, provider: string, usage: any, completeText: string) {
  // Estimate tokens if usage missing
  let promptTokens = Math.ceil(params.userPrompt.length / 4) + Math.ceil(params.systemInstruction.length / 4);
  let completionTokens = Math.ceil(completeText.length / 4);

  if (usage) {
    if (usage.promptTokens) promptTokens = usage.promptTokens;
    else if (usage.prompt_tokens) promptTokens = usage.prompt_tokens;
    else if (usage.input_tokens) promptTokens = usage.input_tokens; // Claude native
    else if (usage.inputTokenCount) promptTokens = usage.inputTokenCount; // Claude/Bedrock style

    if (usage.completionTokens) completionTokens = usage.completionTokens;
    else if (usage.completion_tokens) completionTokens = usage.completion_tokens;
    else if (usage.output_tokens) completionTokens = usage.output_tokens; // Claude native
    else if (usage.outputTokenCount) completionTokens = usage.outputTokenCount; // Claude/Bedrock style
    else if (usage.candidatesTokenCount) completionTokens = usage.candidatesTokenCount; // Google style
  }

  db.aiUsageLogs.add({
    timestamp: Date.now(),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    provider,
    model: params.model || getModelForProvider(provider),
    actionType: params.actionType || 'other'
  }).catch(console.error);
}

function getModelForProvider(provider: string) {
  switch (provider) {
    case 'groq': return 'llama-3.3-70b-versatile';
    case 'openrouter': return 'meta-llama/llama-3.3-70b-instruct:free';
    case 'claude': return 'claude-3-5-sonnet-20241022';
    case 'google': return 'gemini-2.0-flash'; // Using the recommended stable model
    case 'ollama': return 'llama3.2';
    default: return '';
  }
}
