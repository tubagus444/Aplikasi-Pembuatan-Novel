/// <reference lib="webworker" />
import { encodingForModel, TiktokenModel } from 'js-tiktoken';

let encoder: ReturnType<typeof encodingForModel> | null = null;
let currentModel: TiktokenModel | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, text, model = 'gpt-4o' } = e.data;

  if (type === 'COUNT_TOKENS') {
    try {
      if (currentModel !== model || !encoder) {
        encoder = encodingForModel(model as TiktokenModel);
        currentModel = model;
      }
      
      const tokens = encoder.encode(text).length;
      self.postMessage({ type: 'TOKEN_COUNT', tokens, model });
    } catch (err) {
      console.error('Error counting tokens in worker', err);
      // Fallback rough estimate if model is unsupported
      const fallbackTokens = Math.ceil((text || '').length / 4);
      self.postMessage({ type: 'TOKEN_COUNT', tokens: fallbackTokens, model });
    }
  }
};
