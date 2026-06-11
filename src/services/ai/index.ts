import { StoryBibleRule, CodexEntry, ContextDepth, Relationship } from '@/src/types';
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
      claude: loadKey('claude'),
      ollama: '' // Ollama doesn't use API key
    },
    models: {
      google: localStorage.getItem('ai_model_google') || '',
      groq: localStorage.getItem('ai_model_groq') || '',
      openrouter: localStorage.getItem('ai_model_openrouter') || '',
      claude: localStorage.getItem('ai_model_claude') || '',
      ollama: localStorage.getItem('ai_model_ollama') || ''
    }
  };
}

function buildContextBlock(rules: StoryBibleRule[], codex: CodexEntry[], relationships: Relationship[] = [], depth: ContextDepth = 'balanced'): string {
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
  let graph = '';
  
  if (codex.length > 0) {
    // Limits based on depth
    const MAX_LORE_CHARS = depth === 'deep' ? 4000 : 2500;
    const itemLimit = depth === 'deep' ? 1000 : 500; // Deep gets more detail per entry
    const subLimit = depth === 'deep' ? 300 : 150;

    let currentChars = 0;
    const loreParts: string[] = [];
    const includedCodexIds = new Set<number>();

    codex.forEach((e, index) => {
      if (currentChars >= MAX_LORE_CHARS) return;
      if (e.id) includedCodexIds.add(e.id);

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
    
    // Build Relationship Graph (Graph-RAG format)
    if (relationships && relationships.length > 0) {
      const activeRelations = relationships.filter(r => 
        includedCodexIds.has(r.sourceId) || includedCodexIds.has(r.targetId)
      );
      
      if (activeRelations.length > 0) {
        const idToName = Object.fromEntries(codex.map(c => [c.id, c.name]));
        const graphParts = activeRelations.map(r => {
           const srcName = idToName[r.sourceId] || `Entity#${r.sourceId}`;
           const tgtName = idToName[r.targetId] || `Entity#${r.targetId}`;
           let relStr = `${srcName} (${r.type}) -> ${tgtName}`;
           if (r.description) relStr += `: ${r.description}`;
           return relStr;
        });
        graph = `\n\nRELATIONSHIP GRAPH:\n${graphParts.join('\n')}`;
      }
    }
  }
  
  let block = `STORY BIBLE:\n${bible}\n\nCODEX LORE:\n${lore}${graph}`;
  return block;
}

const MAX_RETRIES = 3;
const FALLBACK_ORDER = ['openrouter', 'google', 'claude', 'groq']; // Ordered preference for fallback

// Basic circuit breaker implementation
const circuitBreaker = new Map<string, { failures: number, resetTime: number }>();
const CIRCUIT_OPEN_THRESHOLD = 3; // 3 consecutive failures to open circuit
const CIRCUIT_RESET_TIME = 1000 * 30; // 30 seconds

function checkCircuit(provider: string): boolean {
  const state = circuitBreaker.get(provider);
  if (!state) return true;
  if (state.failures >= CIRCUIT_OPEN_THRESHOLD) {
    if (Date.now() > state.resetTime) {
      // Half-open: allow one trial
      return true;
    }
    return false; // Circuit Open
  }
  return true;
}

function recordSuccess(provider: string) {
  circuitBreaker.delete(provider);
}

function recordFailure(provider: string) {
  const state = circuitBreaker.get(provider) || { failures: 0, resetTime: 0 };
  state.failures += 1;
  state.resetTime = Date.now() + CIRCUIT_RESET_TIME;
  circuitBreaker.set(provider, state);
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

async function callAIWithBackoff(
  params: AIRenderParams,
  provider: string,
  settings: ReturnType<typeof getSettings>,
  isFallback: boolean = false
): Promise<string> {
  let attempt = 1;

  while (attempt <= MAX_RETRIES) {
    if (!checkCircuit(provider)) {
      if (attempt === 1 && !isFallback) {
         // Force fallback if circuit is open on primary provider
         break;
      } else if (isFallback) {
         throw new AIError(`Koneksi ${provider} terputus sementara (Circuit Open).`, 'CIRCUIT_OPEN', provider);
      }
    }

    try {
      if (!params.model) {
        params.model = settings.models[provider as keyof typeof settings.models];
      }

      const apiKey = settings.keys[provider as keyof typeof settings.keys];
      const result = await callProxy(provider, params, apiKey);
      
      recordSuccess(provider);
      return result;

    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      
      recordFailure(provider);
      
      // If unauthorized, don't retry, let it fail immediately so user knows API key is wrong
      if (error.code === 'INVALID_KEY' || error.code === 'UNAUTHORIZED' || error.code === 'QUOTA_EXCEEDED') {
        throw new AIError(error.message, error.code, provider);
      }

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500; // Exponential backoff: 2s, 4s, 8s + jitter
        if (params.onRetry) {
          params.onRetry(attempt, error, provider);
        }
        await wait(delay);
        attempt++;
      } else {
        if (isFallback) {
          throw new AIError(`Gagal menghubungi ${provider} setelah beberapa percobaan.`, error.code || 'API_ERROR', provider);
        } else {
          break; // Move to fallback logic outside this function
        }
      }
    }
  }
  
  throw new AIError(`Gagal menghubungi ${provider} setelah percobaan maksimal.`, 'TIMEOUT', provider);
}

async function callAI(params: AIRenderParams): Promise<string> {
  const settings = getSettings();
  const provider = params.provider || settings.provider;
  
  try {
    return await callAIWithBackoff(params, provider, settings, false);
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    
    // Only attempt fallback if we know it's a connection/server/rate limit issue
    // NOT if there's no API key or Invalid API Key.
    if (error.code !== 'INVALID_KEY' && error.code !== 'QUOTA_EXCEEDED' && error.code !== 'UNAUTHORIZED') {
      for (const fallback of FALLBACK_ORDER) {
        if (fallback === provider) continue; // Already tried
        
        // Ensure they have API key for fallback
        if (!settings.keys[fallback as keyof typeof settings.keys]) continue;
        
        try {
          if (params.onRetry) params.onRetry(1, error, `${fallback} (Cadangan)`);
          const fallbackParams = { ...params, model: undefined, provider: fallback }; // let backup decide its own model
          return await callAIWithBackoff(fallbackParams, fallback, settings, true);
        } catch (fallbackError: any) {
          if (fallbackError.name === 'AbortError') throw fallbackError;
          continue; // Try next fallback
        }
      }
    }
    
    // If we land here, either all fallbacks failed or we didn't try
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
  const provider = params.provider || settings.provider;
  const isCacheSupported = ['google', 'claude', 'openrouter'].includes(provider.toLowerCase());
  
  // RAG for Rewrite
  let textForRAG = params.ragContextText ? params.ragContextText + '\n' + params.selection : params.selection;
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

  let contextBlock = '';
  if (isCacheSupported && settings.contextDepth !== 'minimal') {
    // CACHING MODE: Provide full static knowledge base to maximize cache hits
    const sortedRules = [...params.bibleRules].sort((a, b) => a.key.localeCompare(b.key));
    const sortedCodex = [...params.codexEntries].sort((a, b) => a.name.localeCompare(b.name));
    
    const bibleString = sortedRules.map(r => `${r.key.replace(/__/g, '')}: ${r.instruction}`).join('\n') || 'No specific rules set.';
    const loreString = sortedCodex.map(e => `[${e.name}] (${e.category}): ${e.description}`).join('\n\n').substring(0, 50000) || 'No specific lore.';
    
    let graphString = '';
    if (params.relationships && params.relationships.length > 0) {
      const idToName = Object.fromEntries(params.codexEntries.map(c => [c.id, c.name]));
      const graphParts = params.relationships.map(r => {
         const srcName = idToName[r.sourceId] || `Entity#${r.sourceId}`;
         const tgtName = idToName[r.targetId] || `Entity#${r.targetId}`;
         return `${srcName} (${r.type}) -> ${tgtName}${r.description ? `: ${r.description}` : ''}`;
      });
      graphString = `\n\nRELATIONSHIP GRAPH:\n${graphParts.join('\n')}`;
    }
    
    contextBlock = `STORY BIBLE:\n${bibleString}\n\nCODEX LORE:\n${loreString}${graphString}`;
  } else {
    // LEGACY RAG MODE: Filter dynamically
    const relevantCodex = await getRelevantContext(textForRAG, params.codexEntries);
    const relevantRules = await getRelevantBibleRules(textForRAG, params.bibleRules);
    contextBlock = buildContextBlock(relevantRules, relevantCodex, params.relationships || [], settings.contextDepth);
  }
  
  const systemInstruction = AI_PROMPTS.REWRITE.SYSTEM(contextBlock);
  
  // User Prompt must contain the dynamic scene context to keep the System instruction perfectly static for caching
  let userPrompt = AI_PROMPTS.REWRITE.USER(params.action, params.selection, params.prompt);
  if (relevantScenesText) {
    userPrompt = `RELEVANT CHAPTER SCENES:\n${relevantScenesText}\n\n${userPrompt}`;
  }

  try {
    const controller = new AbortController();
    abortControllers.set('rewrite', controller);
    
    const res = await callAI({
      systemInstruction,
      userPrompt,
      provider: provider,
      temperature: 0.85,
      stream: params.stream,
      onChunk: params.onChunk,
      signal: controller.signal,
      actionType: 'rewrite'
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
  const provider = params.provider || settings.provider;
  const isCacheSupported = ['google', 'claude', 'openrouter'].includes(provider.toLowerCase());
  
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

  let contextBlock = '';
  if (isCacheSupported && settings.contextDepth !== 'minimal') {
    // CACHING MODE: Provide full static knowledge base to maximize cache hits
    const sortedRules = [...params.bibleRules].sort((a, b) => a.key.localeCompare(b.key));
    const sortedCodex = [...params.codexEntries].sort((a, b) => a.name.localeCompare(b.name));
    
    // Hard cap at 50,000 chars to avoid overwhelming local memory before sending to massive context models
    const bibleString = sortedRules.map(r => `${r.key.replace(/__/g, '')}: ${r.instruction}`).join('\n') || 'No specific rules set.';
    const loreString = sortedCodex.map(e => `[${e.name}] (${e.category}): ${e.description}`).join('\n\n').substring(0, 50000) || 'No specific lore.';
    
    let graphString = '';
    if (params.relationships && params.relationships.length > 0) {
      const idToName = Object.fromEntries(params.codexEntries.map(c => [c.id, c.name]));
      const graphParts = params.relationships.map(r => {
         const srcName = idToName[r.sourceId] || `Entity#${r.sourceId}`;
         const tgtName = idToName[r.targetId] || `Entity#${r.targetId}`;
         return `${srcName} (${r.type}) -> ${tgtName}${r.description ? `: ${r.description}` : ''}`;
      });
      graphString = `\n\nRELATIONSHIP GRAPH:\n${graphParts.join('\n')}`;
    }
    
    contextBlock = `STORY BIBLE:\n${bibleString}\n\nCODEX LORE:\n${loreString}${graphString}`;
  } else {
    // LEGACY RAG MODE: Filter dynamically
    const relevantCodex = await getRelevantContext(textForRAG, params.codexEntries);
    const relevantRules = await getRelevantBibleRules(textForRAG, params.bibleRules);
    contextBlock = buildContextBlock(relevantRules, relevantCodex, params.relationships || [], settings.contextDepth);
  }

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
      provider: provider,
      history: trimmedHistory,
      temperature: 0.7,
      stream: params.stream,
      onChunk: params.onChunk,
      signal: controller.signal,
      actionType: 'chat'
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
  const contextBlock = buildContextBlock(bibleRules, [], [], settings.contextDepth);
  const systemInstruction = AI_PROMPTS.EXTRACT_CODEX.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.EXTRACT_CODEX.USER(extractCandidateSentences(text));

  try {
    const res = await callAI({ systemInstruction, userPrompt, temperature: 0.3, actionType: 'extract' });
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
  const contextBlock = buildContextBlock(bibleRules, [], [], settings.contextDepth);
  const systemInstruction = AI_PROMPTS.EXPAND_CODEX.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.EXPAND_CODEX.USER(name, category, currentDescription);
  
  return await callAI({ 
    systemInstruction, 
    userPrompt, 
    temperature: 0.9,
    maxTokens: 1000,
    actionType: 'expand'
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

