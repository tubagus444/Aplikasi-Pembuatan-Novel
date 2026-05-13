import { StoryBibleRule, CodexEntry } from "../../types";
import { getRelevantContext, getRelevantBibleRules } from "../contextEngine";
import { callGemini } from "./gemini";
import { callProxy } from "./proxy";
import { GenerateParams, ChatParams, AIRenderParams } from "./types";
import { ErrorService } from "../errorService";
import { AI_PROMPTS } from "../../lib/aiPrompts";

export class AIError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AIError';
  }
}

const abortControllers = new Map<string, AbortController>();

export function cancelAI(type?: string) {
  if (type) {
    const controller = abortControllers.get(type);
    if (controller) {
      controller.abort();
      abortControllers.delete(type);
    }
  } else {
    // Cancel all
    abortControllers.forEach(controller => controller.abort());
    abortControllers.clear();
  }
}

function getSettings() {
  const loadKey = (name: string) => {
    try {
      const session = sessionStorage.getItem(`ai_key_${name}`);
      if (session) return session;
      const stored = localStorage.getItem(`ai_key_${name}`);
      return stored ? atob(stored) : '';
    } catch (e) {
      return '';
    }
  };

  return {
    provider: localStorage.getItem('ai_provider') || 'google',
    keys: {
      google: loadKey('google') || process.env.GEMINI_API_KEY || '',
      groq: loadKey('groq'),
      openrouter: loadKey('openrouter'),
      claude: loadKey('claude')
    },
    models: {
      google: localStorage.getItem('ai_model_google') || '',
      groq: localStorage.getItem('ai_model_groq') || '',
      openrouter: localStorage.getItem('ai_model_openrouter') || '',
      claude: localStorage.getItem('ai_model_claude') || ''
    }
  };
}

function buildContextBlock(rules: StoryBibleRule[], codex: CodexEntry[]): string {
  const bible = rules.length
    ? rules.map(r => `${r.key}: ${r.instruction}`).join('\n')
    : 'No specific rules set.';
  const lore = codex.length
    ? codex.map(e => `[${e.name}]: ${e.description.substring(0, 200) + (e.description.length > 200 ? '...' : '')}`).join('\n')
    : 'No specific lore relevant to this passage.';
  return `STORY BIBLE:\n${bible}\n\nCODEX LORE:\n${lore}`;
}

async function callAI(params: AIRenderParams): Promise<string> {
  const settings = getSettings();
  const provider = params.provider || settings.provider;
  
  try {
    // Inject custom model if available for the provider
    if (!params.model) {
      params.model = settings.models[provider as keyof typeof settings.models];
    }

    // Prefer proxy for all providers to hide keys if possible and avoid CORS
    return await callProxy(provider, params, settings.keys[provider as keyof typeof settings.keys]);
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    
    const aiError = new AIError(error.message || 'AI processing failed', 'API_ERROR');
    ErrorService.log({
      message: aiError.message,
      type: 'error',
      source: `AI-Service (${provider})`,
      metadata: { params: { ...params, signal: undefined }, provider }
    });
    throw aiError;
  }
}

function extractCandidateSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const candidates = sentences.filter(s => /\b[A-Z][a-z]{2,}/.test(s));
  return candidates.slice(0, 60).join(' ');
}

// Facade Methods

export async function processRewrite(params: GenerateParams): Promise<string> {
  const relevantCodex = await getRelevantContext(params.selection, params.codexEntries);
  const relevantRules = await getRelevantBibleRules(params.selection, params.bibleRules);
  const contextBlock = buildContextBlock(relevantRules, relevantCodex);

  const systemInstruction = AI_PROMPTS.REWRITE.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.REWRITE.USER(params.action, params.selection, params.prompt);

  try {
    const controller = new AbortController();
    abortControllers.set('rewrite', controller);
    
    const res = await callAI({
      systemInstruction,
      userPrompt,
      provider: params.provider,
      temperature: 0.85,
      signal: controller.signal
    });
    abortControllers.delete('rewrite');
    return res;
  } catch (error) {
    abortControllers.delete('rewrite');
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI rewrite failed.', "API_ERROR");
  }
}

export async function processChat(params: ChatParams): Promise<string> {
  const contextSource = `${params.contextText || ''} ${params.message || ''}`;
  const relevantCodex = await getRelevantContext(contextSource, params.codexEntries);
  const relevantRules = await getRelevantBibleRules(contextSource, params.bibleRules);
  const contextBlock = buildContextBlock(relevantRules, relevantCodex);

  const systemInstruction = AI_PROMPTS.CHAT.SYSTEM(
    contextBlock, 
    params.contextText?.substring(0, 2000) || ''
  );

  try {
    const controller = new AbortController();
    abortControllers.set('chat', controller);
    
    const res = await callAI({
      systemInstruction,
      userPrompt: params.message,
      provider: params.provider,
      history: params.history,
      temperature: 0.7,
      signal: controller.signal
    });
    abortControllers.delete('chat');
    return res;
  } catch (error) {
    abortControllers.delete('chat');
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI chat failed.', "API_ERROR");
  }
}

export async function extractToCodex(
  text: string,
  bibleRules: StoryBibleRule[]
): Promise<{name: string, category: string, description: string, aliases: string[]}[]> {
  const contextBlock = buildContextBlock(bibleRules, []);
  const systemInstruction = AI_PROMPTS.EXTRACT_CODEX.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.EXTRACT_CODEX.USER(extractCandidateSentences(text));

  try {
    const res = await callAI({ systemInstruction, userPrompt, temperature: 0.3 });
    let textData = res.replace(/^```json/m, '').replace(/^```/m, '').trim();
    const startIdx = textData.indexOf('[');
    const endIdx = textData.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      textData = textData.substring(startIdx, endIdx + 1);
    }
    return JSON.parse(textData);
  } catch (error) {
    console.error('Extraction Error:', error);
    ErrorService.log({
      message: 'Failed to extract codex entries: ' + (error instanceof Error ? error.message : String(error)),
      type: 'error',
      source: 'AI-Service (Extract)',
      metadata: { text: text.substring(0, 100) }
    });
    throw new AIError('Failed to extract codex entries.', 'PARSE_ERROR');
  }
}

export async function expandCodexEntry(
  name: string,
  category: string,
  currentDescription: string,
  bibleRules: StoryBibleRule[]
): Promise<string> {
  const contextBlock = buildContextBlock(bibleRules, []);
  const systemInstruction = AI_PROMPTS.EXPAND_CODEX.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.EXPAND_CODEX.USER(name, category, currentDescription);
  
  return await callAI({ systemInstruction, userPrompt, temperature: 0.9 });
}

export async function testConnection(provider: string, apiKey: string, model?: string): Promise<boolean> {
  try {
    const params: AIRenderParams = {
      systemInstruction: AI_PROMPTS.TEST_CONNECTION.SYSTEM,
      userPrompt: AI_PROMPTS.TEST_CONNECTION.USER,
      temperature: 0.1,
      model: model || undefined
    };

    let result = '';
    result = await callProxy(provider, params, apiKey);
    
    return result.includes('OK') || result.length > 0;
  } catch (error) {
    console.error(`Connection test failed for ${provider}:`, error);
    throw error;
  }
}
