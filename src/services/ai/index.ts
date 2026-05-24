import { StoryBibleRule, CodexEntry, ContextDepth } from '@/src/types';
import { getRelevantContext, getRelevantBibleRules } from '@/src/services/contextEngine';
import { callProxy } from '@/src/services/ai/proxy';
import { GenerateParams, ChatParams, AIRenderParams } from '@/src/services/ai/types';
import { ErrorService } from '@/src/services/errorService';
import { AI_PROMPTS } from '@/src/lib/aiPrompts';

export class AIError extends Error {
  code: string;
  provider?: string;
  
  constructor(message: string, code: string, provider?: string) {
    super(message);
    this.code = code;
    this.provider = provider;
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
    contextDepth: (localStorage.getItem('ai_context_depth') as ContextDepth) || 'balanced',
    keys: {
      google: loadKey('google'),
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

function buildContextBlock(rules: StoryBibleRule[], codex: CodexEntry[], depth: ContextDepth = 'balanced'): string {
  // If depth is minimal, we only include the most core rules and no lore
  if (depth === 'minimal') {
    const coreKeys = ['__STORY_TITLE__', '__GENRES__', '__POV__'];
    const bible = rules
      .filter(r => coreKeys.includes(r.key))
      .map(r => `${r.key.replace(/__/g, '')}: ${r.instruction}`)
      .join('\n');
    
    return bible ? `CORE RULES:\n${bible}` : '';
  }

  const bible = rules.length
    ? rules.map(r => `${r.key}: ${r.instruction}`).join('\n')
    : 'No specific rules set.';

  let lore = 'No specific lore relevant to this passage.';
  if (codex.length > 0) {
    // Limits based on depth
    const MAX_LORE_CHARS = depth === 'deep' ? 4000 : 2500;
    const itemLimit = depth === 'deep' ? 1000 : 500; // Deep gets more detail per entry
    const subLimit = depth === 'deep' ? 300 : 150;

    let currentChars = 0;
    const loreParts: string[] = [];

    codex.forEach((e, index) => {
      if (currentChars >= MAX_LORE_CHARS) return;

      const limit = index < 3 ? itemLimit : subLimit;
      let desc = e.description.trim();
      if (desc.length > limit) {
        desc = desc.substring(0, limit) + '...';
      }

      const formattedEntry = `[${e.name}]: ${desc}`;
      
      if (currentChars + formattedEntry.length <= MAX_LORE_CHARS) {
        loreParts.push(formattedEntry);
        currentChars += formattedEntry.length + 1;
      }
    });

    if (loreParts.length > 0) {
      lore = loreParts.join('\n');
    }
  }
  
  let block = `STORY BIBLE:\n${bible}\n\nCODEX LORE:\n${lore}`;
  return block;
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
    
    // Check if error is already classified from proxy
    const aiError = new AIError(
      error.message || 'AI processing failed', 
      error.code || 'API_ERROR',
      provider
    );

    ErrorService.log({
      message: aiError.message,
      type: 'error',
      source: `AI-Service (${provider})`,
      metadata: { 
        params: { ...params, signal: undefined }, 
        provider,
        code: aiError.code,
        rawMessage: error.rawMessage
      }
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
  const settings = getSettings();
  
  // RAG for Rewrite
  let textForRAG = params.selection;
  let relevantScenesText = '';
  
  if (params.contextText && params.contextText.length > 500) {
     const { splitIntoScenes, getRelevantScenes, buildExcerptContext } = await import('@/src/lib/chunkEngine');
     const scenes = splitIntoScenes(params.contextText);
     const relevantScenes = getRelevantScenes(params.selection, scenes, params.codexEntries);
     if (relevantScenes.length > 0) {
        relevantScenesText = buildExcerptContext(relevantScenes);
        textForRAG += '\n' + relevantScenesText;
     }
  } else if (params.contextText) {
     textForRAG += '\n' + params.contextText;
  }

  const relevantCodex = await getRelevantContext(textForRAG, params.codexEntries);
  const relevantRules = await getRelevantBibleRules(textForRAG, params.bibleRules);
  
  let contextBlock = buildContextBlock(relevantRules, relevantCodex, settings.contextDepth);
  if (relevantScenesText) {
    contextBlock = `RELEVANT CHAPTER SCENES:\n${relevantScenesText}\n\n${contextBlock}`;
  }
  
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
  const settings = getSettings();
  
  // RAG for Chat
  let textForRAG = params.message;
  let relevantScenesText = '';
  let draftSnippet = params.contextText?.substring(0, 3000) || '';
  
  if (params.contextText && params.contextText.length > 1000 && params.sessionMode !== 'plot-check') {
     const { splitIntoScenes, getRelevantScenes, buildExcerptContext, getLastScene } = await import('@/src/lib/chunkEngine');
     const scenes = splitIntoScenes(params.contextText);
     const relevantScenes = getRelevantScenes(params.message, scenes, params.codexEntries);
     
     if (relevantScenes.length > 0) {
        relevantScenesText = buildExcerptContext(relevantScenes);
        textForRAG += '\n' + relevantScenesText;
        draftSnippet = relevantScenesText; // Only send relevant scenes to AI instead of 3000 chars
     } else {
        const lastScene = getLastScene(scenes);
        if (lastScene) {
          relevantScenesText = buildExcerptContext([lastScene]);
          textForRAG += '\n' + relevantScenesText;
          draftSnippet = relevantScenesText;
        }
     }
  } else {
     textForRAG += ' ' + (params.contextText || '');
  }

  const relevantCodex = await getRelevantContext(textForRAG, params.codexEntries);
  const relevantRules = await getRelevantBibleRules(textForRAG, params.bibleRules);
  
  const contextBlock = buildContextBlock(relevantRules, relevantCodex, settings.contextDepth);

  const systemInstruction = AI_PROMPTS.CHAT.SYSTEM(contextBlock, params.sessionMode);
  const userPromptWithContext = AI_PROMPTS.CHAT.USER(params.message, draftSnippet);

  // SMART PRUNING: Keep only the most recent part of history to save tokens
  // A turn is 2 messages (user + model). 10 messages = 5 turns.
  const MAX_HISTORY_MESSAGES = 10;
  const trimmedHistory = params.history && params.history.length > MAX_HISTORY_MESSAGES
    ? params.history.slice(-MAX_HISTORY_MESSAGES)
    : params.history;

  try {
    const controller = new AbortController();
    abortControllers.set('chat', controller);
    
    const res = await callAI({
      systemInstruction,
      userPrompt: userPromptWithContext,
      provider: params.provider,
      history: trimmedHistory,
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
  const settings = getSettings();
  const contextBlock = buildContextBlock(bibleRules, [], settings.contextDepth);
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
  } catch (error: any) {
    console.error('Extraction Error:', error);
    if (error instanceof AIError) throw error;
    ErrorService.log({
      message: 'Failed to extract codex entries: ' + (error instanceof Error ? error.message : String(error)),
      type: 'error',
      source: 'AI-Service (Extract)',
      metadata: { text: text.substring(0, 100) }
    });
    throw new AIError('Failed to extract codex entries.', 'API_ERROR');
  }
}

export async function expandCodexEntry(
  name: string,
  category: string,
  currentDescription: string,
  bibleRules: StoryBibleRule[]
  ): Promise<string> {
  const settings = getSettings();
  const contextBlock = buildContextBlock(bibleRules, [], settings.contextDepth);
  const systemInstruction = AI_PROMPTS.EXPAND_CODEX.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.EXPAND_CODEX.USER(name, category, currentDescription);
  
  return await callAI({ 
    systemInstruction, 
    userPrompt, 
    temperature: 0.9,
    maxTokens: 1000 // Limit output length for codex expansion
  });
}

export async function testConnection(provider: string, apiKey: string, model?: string): Promise<boolean> {
  try {
    const params: AIRenderParams = {
      systemInstruction: AI_PROMPTS.TEST_CONNECTION.SYSTEM(),
      userPrompt: AI_PROMPTS.TEST_CONNECTION.USER(),
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

export async function fetchGoogleModels(apiKey: string): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch('/api/ai/google-models', {
    method: 'POST',
    headers: headers
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error && typeof parsed.error === 'object') {
        errorMessage = parsed.error.message || JSON.stringify(parsed.error);
      } else {
        errorMessage = parsed.error || parsed.message || text;
      }
    } catch (e) {
      // ignore
    }
    throw new Error(errorMessage || 'Failed to fetch authorized Google models');
  }

  return await response.json();
}

