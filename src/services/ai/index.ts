import { StoryBibleRule, CodexEntry, ContextDepth, Relationship, ConsistencyFinding } from '@/src/types';
import { getRelevantContext, getRelevantBibleRules } from '@/src/services/contextEngine';
import { callProxy, getLightModelForProvider } from '@/src/services/ai/proxy';
import { GenerateParams, ChatParams, ConsistencyParams, AIRenderParams } from '@/src/services/ai/types';
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

// Satu tipe aksi bisa punya beberapa panggilan berjalan bersamaan, jadi simpan
// kumpulan controller per-tipe agar pembatalan & pembersihan tidak salah sasaran.
const abortControllers = new Map<string, Set<AbortController>>();

function registerAbort(type: string, controller: AbortController) {
  let set = abortControllers.get(type);
  if (!set) {
    set = new Set();
    abortControllers.set(type, set);
  }
  set.add(controller);
}

function unregisterAbort(type: string, controller: AbortController) {
  const set = abortControllers.get(type);
  if (set) {
    set.delete(controller);
    if (set.size === 0) abortControllers.delete(type);
  }
}

export function cancelAI(type?: string) {
  if (type) {
    const set = abortControllers.get(type);
    if (set) {
      set.forEach(controller => controller.abort());
      abortControllers.delete(type);
    }
  } else {
    // Cancel all
    abortControllers.forEach(set => set.forEach(controller => controller.abort()));
    abortControllers.clear();
  }
}

const CACHE_SUPPORTED_PROVIDERS = ['google', 'claude', 'openrouter'];
const MAX_CACHED_LORE_CHARS = 50000;

function isCacheSupported(provider: string): boolean {
  return CACHE_SUPPORTED_PROVIDERS.includes(provider.toLowerCase());
}

/** Membangun blok "RELATIONSHIP GRAPH" (Graph-RAG) dari relasi yang diberikan. */
function buildRelationshipGraph(relationships: Relationship[], codex: CodexEntry[]): string {
  if (!relationships || relationships.length === 0) return '';
  const idToName = Object.fromEntries(codex.map(c => [c.id, c.name]));
  const parts = relationships.map(r => {
    const srcName = idToName[r.sourceId] || `Entity#${r.sourceId}`;
    const tgtName = idToName[r.targetId] || `Entity#${r.targetId}`;
    return `${srcName} (${r.type}) -> ${tgtName}${r.description ? `: ${r.description}` : ''}`;
  });
  return `\n\nRELATIONSHIP GRAPH:\n${parts.join('\n')}`;
}

/**
 * Mode caching: seluruh Story Bible + Codex diurutkan deterministik agar system
 * prompt benar-benar statis (memaksimalkan cache prompt provider).
 */
function buildCachedContextBlock(bibleRules: StoryBibleRule[], codexEntries: CodexEntry[], relationships: Relationship[] = []): string {
  const sortedRules = [...bibleRules].sort((a, b) => a.key.localeCompare(b.key));
  const sortedCodex = [...codexEntries].sort((a, b) => a.name.localeCompare(b.name));

  const bibleString = sortedRules.map(r => `${r.key.replace(/__/g, '')}: ${r.instruction}`).join('\n') || 'No specific rules set.';
  const loreString = sortedCodex.map(e => `[${e.name}] (${e.category}): ${e.description}`).join('\n\n').substring(0, MAX_CACHED_LORE_CHARS) || 'No specific lore.';
  const graphString = buildRelationshipGraph(relationships, codexEntries);

  return `STORY BIBLE:\n${bibleString}\n\nCODEX LORE:\n${loreString}${graphString}`;
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
    
    // Build Relationship Graph (Graph-RAG format), hanya relasi yang menyentuh codex relevan.
    if (relationships && relationships.length > 0) {
      const activeRelations = relationships.filter(r =>
        includedCodexIds.has(r.sourceId) || includedCodexIds.has(r.targetId)
      );
      graph = buildRelationshipGraph(activeRelations, codex);
    }
  }
  
  let block = `STORY BIBLE:\n${bible}\n\nCODEX LORE:\n${lore}${graph}`;
  return block;
}

const MAX_RETRIES = 3;
const FALLBACK_ORDER = ['openrouter', 'google', 'claude', 'groq']; // Ordered preference for fallback

// Tugas mekanis (bukan penulisan kreatif) dirutekan ke model tier-murah provider
// yang sama. rewrite/chat/expand tetap memakai model pilihan pengguna demi kualitas.
const LIGHT_TASK_ACTIONS = new Set(['extract', 'summarize']);

// Basic circuit breaker implementation
const circuitBreaker = new Map<string, { failures: number, resetTime: number, halfOpenInFlight?: boolean }>();
const CIRCUIT_OPEN_THRESHOLD = 3; // 3 consecutive failures to open circuit
const CIRCUIT_RESET_TIME = 1000 * 30; // 30 seconds

function checkCircuit(provider: string): boolean {
  const state = circuitBreaker.get(provider);
  if (!state) return true;
  if (state.failures >= CIRCUIT_OPEN_THRESHOLD) {
    if (Date.now() > state.resetTime) {
      // Half-open: izinkan hanya SATU percobaan; blokir request lain sampai hasilnya diketahui.
      if (state.halfOpenInFlight) return false;
      state.halfOpenInFlight = true;
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
  state.halfOpenInFlight = false; // percobaan half-open gagal → buka kembali
  circuitBreaker.set(provider, state);
}

function clearHalfOpen(provider: string) {
  const state = circuitBreaker.get(provider);
  if (state) state.halfOpenInFlight = false;
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

async function callAIWithBackoff(
  params: AIRenderParams,
  provider: string,
  settings: ReturnType<typeof getSettings>,
  isFallback: boolean = false
): Promise<string> {
  let attempt = 1;
  // Hindari mutasi objek params milik pemanggil; resolusi model & key dilakukan lokal.
  let model = params.model || settings.models[provider as keyof typeof settings.models];
  // Routing per-tugas: tugas mekanis pakai model murah provider yang sama (kecuali
  // pemanggil sudah memaksa model tertentu lewat params.model).
  if (!params.model && params.actionType && LIGHT_TASK_ACTIONS.has(params.actionType)) {
    model = getLightModelForProvider(provider) || model;
  }
  const apiKey = settings.keys[provider as keyof typeof settings.keys];

  while (attempt <= MAX_RETRIES) {
    if (!checkCircuit(provider)) {
      // Circuit terbuka: provider utama langsung dialihkan ke fallback; fallback digagalkan.
      if (isFallback) {
        throw new AIError(`Koneksi ${provider} terputus sementara (Circuit Open).`, 'CIRCUIT_OPEN', provider);
      }
      break;
    }

    try {
      const result = await callProxy(provider, { ...params, model }, apiKey);

      recordSuccess(provider);
      return result;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        clearHalfOpen(provider); // jangan biarkan trial half-open menggantung karena pembatalan
        throw error;
      }

      recordFailure(provider);

      // Kunci salah / kuota habis: percuma diulang, lempar segera agar user tahu.
      if (error.code === 'INVALID_KEY' || error.code === 'QUOTA_EXCEEDED') {
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
    if (error.code !== 'INVALID_KEY' && error.code !== 'QUOTA_EXCEEDED') {
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

    // Metadata harus serializable untuk IndexedDB (structured clone): JANGAN sertakan
    // fungsi (onChunk/onRetry) atau AbortSignal, dan potong prompt agar tidak membengkak.
    ErrorService.log({
      message: aiError.message,
      type: 'error',
      source: `AI-Service (${provider})`,
      metadata: {
        provider,
        code: aiError.code,
        actionType: params.actionType,
        model: params.model,
        rawMessage: typeof error.rawMessage === 'string' ? error.rawMessage.slice(0, 1000) : undefined,
        promptPreview: params.userPrompt?.slice(0, 500)
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

/** Mengupas respons model (yang kerap dibungkus code fence/prosa) menjadi array JSON. */
function parseJsonArray(raw: string): any[] {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.substring(start, end + 1);
  }

  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Hasil ekstraksi bukan array JSON.');
  return data;
}

// Facade Methods

export async function processRewrite(params: GenerateParams): Promise<string> {
  const settings = getSettings();
  const provider = params.provider || settings.provider;

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

  const useCaching = isCacheSupported(provider) && settings.contextDepth !== 'minimal';
  let contextBlock = '';
  if (useCaching) {
    // CACHING MODE: knowledge base statis penuh untuk memaksimalkan cache prompt
    contextBlock = buildCachedContextBlock(params.bibleRules, params.codexEntries, params.relationships || []);
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

  // Plafon output adaptif: rewrite bisa memanjangkan teks, jadi beri ruang ~2.5x
  // token seleksi, dengan lantai & langit-langit agar tak boros maupun terpotong.
  const selectionTokens = Math.ceil((params.selection?.length || 0) / 4);
  const rewriteMaxTokens = Math.min(4000, Math.max(512, Math.ceil(selectionTokens * 2.5)));

  const controller = new AbortController();
  registerAbort('rewrite', controller);
  try {
    const res = await callAI({
      systemInstruction,
      userPrompt,
      provider: provider,
      temperature: 0.85,
      maxTokens: rewriteMaxTokens,
      stream: params.stream,
      onChunk: params.onChunk,
      signal: controller.signal,
      actionType: 'rewrite',
      cacheable: useCaching
    });
    return res;
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI rewrite failed.', "API_ERROR");
  } finally {
    unregisterAbort('rewrite', controller);
  }
}

export async function processChat(params: ChatParams): Promise<string> {
  const settings = getSettings();
  const provider = params.provider || settings.provider;

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

  const useCaching = isCacheSupported(provider) && settings.contextDepth !== 'minimal';
  let contextBlock = '';
  if (useCaching) {
    // CACHING MODE: knowledge base statis penuh untuk memaksimalkan cache prompt
    contextBlock = buildCachedContextBlock(params.bibleRules, params.codexEntries, params.relationships || []);
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

  const controller = new AbortController();
  registerAbort('chat', controller);
  try {
    const res = await callAI({
      systemInstruction,
      userPrompt: userPromptWithContext,
      provider: provider,
      history: trimmedHistory,
      temperature: 0.7,
      maxTokens: 2048,
      stream: params.stream,
      onChunk: params.onChunk,
      signal: controller.signal,
      actionType: 'chat',
      cacheable: useCaching
    });
    return res;
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI chat failed.', "API_ERROR");
  } finally {
    unregisterAbort('chat', controller);
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
    const res = await callAI({ systemInstruction, userPrompt, temperature: 0.3, maxTokens: 1500, actionType: 'extract' });
    return parseJsonArray(res);
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

// Plafon teks bab yang dikirim untuk pengecekan konsistensi (~12k token).
// Bab lebih panjang dipotong; UI memberi tahu pengguna bila terjadi pemotongan.
const MAX_CONSISTENCY_CHARS = 48000;

/** Membersihkan & memvalidasi satu temuan mentah dari model menjadi ConsistencyFinding. */
function sanitizeFinding(raw: any): ConsistencyFinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const quote = typeof raw.quote === 'string' ? raw.quote.trim() : '';
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  // Butuh minimal kutipan + penjelasan agar temuan bermakna & bisa dilacak penulis.
  if (!quote || !explanation) return null;

  const severity = ['high', 'medium', 'low'].includes(raw.severity) ? raw.severity : 'medium';
  return {
    severity,
    type: typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : 'Lainnya',
    quote: quote.slice(0, 500),
    conflictsWith: typeof raw.conflictsWith === 'string' ? raw.conflictsWith.trim().slice(0, 500) : '',
    explanation: explanation.slice(0, 1000),
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion.trim().slice(0, 1000) : ''
  };
}

/**
 * Memeriksa satu bab terhadap knowledge base (Story Bible + Codex + relasi) dan
 * logika internalnya, lalu mengembalikan daftar temuan inkonsistensi terstruktur.
 * Selalu mengirim knowledge base penuh (bukan RAG-filtered) karena pengecekan
 * harus melihat seluruh entri untuk menangkap kontradiksi.
 */
export async function checkConsistency(params: ConsistencyParams): Promise<{ findings: ConsistencyFinding[]; truncated: boolean }> {
  const settings = getSettings();
  const provider = params.provider || settings.provider;

  const useCaching = isCacheSupported(provider) && settings.contextDepth !== 'minimal';
  let contextBlock = buildCachedContextBlock(params.bibleRules, params.codexEntries, params.relationships || []);
  // Timeline membantu AI menangkap pelanggaran urutan waktu (peristiwa di luar kronologi).
  if (params.timelineSummary && params.timelineSummary.trim()) {
    contextBlock += `\n\nSTORY TIMELINE (urutan kronologis peristiwa cerita):\n${params.timelineSummary.trim()}`;
  }

  const fullText = params.chapterText || '';
  const truncated = fullText.length > MAX_CONSISTENCY_CHARS;
  const chapterText = truncated ? fullText.slice(0, MAX_CONSISTENCY_CHARS) : fullText;

  const systemInstruction = AI_PROMPTS.CONSISTENCY.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.CONSISTENCY.USER(params.chapterTitle || '', chapterText);

  const controller = new AbortController();
  registerAbort('consistency', controller);
  try {
    const res = await callAI({
      systemInstruction,
      userPrompt,
      provider,
      temperature: 0.2, // analitis: minim kreativitas, maksimal konsistensi
      maxTokens: 2048,
      signal: controller.signal,
      actionType: 'consistency',
      cacheable: useCaching,
      onRetry: params.onRetry
    });
    const findings = parseJsonArray(res)
      .map(sanitizeFinding)
      .filter((f): f is ConsistencyFinding => f !== null);
    return { findings, truncated };
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'Pengecekan konsistensi gagal.', 'API_ERROR');
  } finally {
    unregisterAbort('consistency', controller);
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

