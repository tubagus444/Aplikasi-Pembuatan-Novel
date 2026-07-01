import { StoryBibleRule, CodexEntry, ContextDepth, Relationship, ConsistencyFinding } from '@/src/types';
import { getRelevantContext, getRelevantBibleRules } from '@/src/services/contextEngine';
import { callProxy, getLightModelForProvider } from '@/src/services/ai/proxy';
import { GenerateParams, ChatParams, ConsistencyParams, AIRenderParams } from '@/src/services/ai/types';
import { ErrorService } from '@/src/services/errorService';
import { AI_PROMPTS } from '@/src/lib/aiPrompts';
import { cleanRewriteOutput } from '@/src/lib/cleanRewriteOutput';
import { formatBibleBlock } from '@/src/lib/storyBible';
import { getMaxCachedLoreChars, getRewriteTemperature } from '@/src/lib/aiTuning';

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

// Dedup rewrite konkuren: panggilan identik yang masih berjalan berbagi promise yang
// sama. Lihat catatan di processRewrite.
const inFlightRewrites = new Map<string, Promise<string>>();

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

export function isCacheSupported(provider: string): boolean {
  return CACHE_SUPPORTED_PROVIDERS.includes(provider.toLowerCase());
}

// Perkiraan jendela konteks (token) per provider — dipakai meter konteks sebagai
// denominator headroom. Nilai konservatif; model spesifik bisa berbeda, tapi cukup
// sebagai indikator visual "seberapa penuh konteks".
const PROVIDER_CONTEXT_WINDOW: Record<string, number> = {
  google: 1_000_000,
  claude: 200_000,
  openrouter: 128_000,
  groq: 32_000,
  huggingface: 32_000,
  ollama: 8_192,
};

export function getContextWindow(provider: string): number {
  return PROVIDER_CONTEXT_WINDOW[provider?.toLowerCase()] ?? 8_192;
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
 * Mode caching: Story Bible + Codex diurutkan deterministik menjadi SEGMEN ber-tier
 * (stabil→volatil) agar system prompt statis & cache-able. Segmen 0 = Story Bible
 * (jarang berubah), segmen 1 = Codex lore + relationship graph (sering diedit). Proxy
 * memberi tiap segmen cache breakpoint sendiri sehingga edit satu entri Codex hanya
 * membatalkan segmen volatil; prefix Bible tetap hit (#P3). Join('\n\n') memulihkan blok
 * tunggal lama (dipakai jalur non-caching). Segmen byte-identik antar-aksi & antar-panggilan.
 */
function buildCachedContextSegments(bibleRules: StoryBibleRule[], codexEntries: CodexEntry[], relationships: Relationship[] = []): string[] {
  const sortedRules = [...bibleRules].sort((a, b) => a.key.localeCompare(b.key));
  const sortedCodex = [...codexEntries].sort((a, b) => a.name.localeCompare(b.name));

  const bibleString = formatBibleBlock(sortedRules) || 'No specific rules set.';
  const loreString = sortedCodex.map(e => `[${e.name}] (${e.category}): ${e.description}`).join('\n\n').substring(0, getMaxCachedLoreChars()) || 'No specific lore.';
  const graphString = buildRelationshipGraph(relationships, codexEntries);

  return [
    `STORY BIBLE:\n${bibleString}`,
    `CODEX LORE:\n${loreString}${graphString}`,
  ];
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
      huggingface: loadKey('huggingface'),
      ollama: '' // Ollama doesn't use API key
    },
    models: {
      google: localStorage.getItem('ai_model_google') || '',
      groq: localStorage.getItem('ai_model_groq') || '',
      openrouter: localStorage.getItem('ai_model_openrouter') || '',
      claude: localStorage.getItem('ai_model_claude') || '',
      huggingface: localStorage.getItem('ai_model_huggingface') || '',
      ollama: localStorage.getItem('ai_model_ollama') || ''
    }
  };
}

function buildContextBlock(rules: StoryBibleRule[], codex: CodexEntry[], relationships: Relationship[] = [], depth: ContextDepth = 'balanced'): string {
  // If depth is minimal, we only include the most core rules and no lore
  if (depth === 'minimal') {
    const coreKeys = ['__STORY_TITLE__', '__GENRES__', '__POV__'];
    const bible = formatBibleBlock(rules.filter(r => coreKeys.includes(r.key)));

    return bible ? `CORE RULES:\n${bible}` : '';
  }

  const bible = formatBibleBlock(rules) || 'No specific rules set.';

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
const FALLBACK_ORDER = ['openrouter', 'google', 'claude', 'groq', 'huggingface']; // Ordered preference for fallback

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

  // Dedup in-flight: panggilan rewrite identik yang masih berjalan berbagi promise yang
  // sama → cegah panggilan kembar (mis. trigger ganda tak sengaja). Panggilan BERURUTAN
  // tak terpengaruh karena entri terhapus saat selesai, jadi "regenerate" tetap memberi
  // variasi baru. Catatan: peserta kedua berbagi stream peserta pertama sehingga onChunk-nya
  // tak terpanggil — ia tetap menerima hasil final via promise. Cukup untuk kasus double-fire.
  const dedupKey = `${provider}|${params.action}|${params.prompt ?? ''}|${params.selection ?? ''}`;
  const existing = inFlightRewrites.get(dedupKey);
  if (existing) return existing;

  const task = (async (): Promise<string> => {
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
  // P0: di caching mode, KB statis dipisah ke cachedContext (blok cache PERTAMA yang
  // identik lintas-aksi) agar rewrite/chat/consistency berbagi satu cache prefix;
  // systemInstruction menyisakan instruksi aksi saja. Non-caching: gabung seperti biasa.
  let cachedContext: string[] | undefined;
  let systemInstruction: string;
  if (useCaching) {
    // CACHING MODE: knowledge base statis penuh untuk memaksimalkan cache prompt
    cachedContext = buildCachedContextSegments(params.bibleRules, params.codexEntries, params.relationships || []);
    systemInstruction = AI_PROMPTS.REWRITE.SYSTEM();
  } else {
    // LEGACY RAG MODE: Filter dynamically
    const relevantCodex = await getRelevantContext(textForRAG, params.codexEntries);
    const relevantRules = await getRelevantBibleRules(textForRAG, params.bibleRules);
    const contextBlock = buildContextBlock(relevantRules, relevantCodex, params.relationships || [], settings.contextDepth);
    systemInstruction = AI_PROMPTS.REWRITE.SYSTEM(contextBlock);
  }

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
      cachedContext,
      userPrompt,
      provider: provider,
      // Tugas editor (perbaikan gaya/konsistensi), bukan generasi kreatif bebas —
      // suhu rendah membuat hasil lebih taat instruksi & tak liar. Default 0.5,
      // bisa diatur pengguna di Settings → Optimasi AI Lanjutan.
      temperature: getRewriteTemperature(),
      maxTokens: rewriteMaxTokens,
      stream: params.stream,
      onChunk: params.onChunk,
      signal: controller.signal,
      actionType: 'rewrite',
      cacheable: useCaching
    });
    return cleanRewriteOutput(res);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI rewrite failed.', "API_ERROR");
  } finally {
    unregisterAbort('rewrite', controller);
  }
  })();

  inFlightRewrites.set(dedupKey, task);
  try {
    return await task;
  } finally {
    inFlightRewrites.delete(dedupKey);
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
  // P0: KB statis dipisah ke cachedContext (blok cache PERTAMA, identik lintas-aksi).
  // Instruksi mode (prose-review/plot-check/brainstorm) tetap di systemInstruction →
  // blok KB pun dibagi antar-mode chat, bukan cuma antar-aksi.
  let cachedContext: string[] | undefined;
  let systemInstruction: string;
  if (useCaching) {
    // CACHING MODE: knowledge base statis penuh untuk memaksimalkan cache prompt
    cachedContext = buildCachedContextSegments(params.bibleRules, params.codexEntries, params.relationships || []);
    systemInstruction = AI_PROMPTS.CHAT.SYSTEM(undefined, params.sessionMode);
  } else {
    // LEGACY RAG MODE: Filter dynamically
    const relevantCodex = await getRelevantContext(textForRAG, params.codexEntries);
    const relevantRules = await getRelevantBibleRules(textForRAG, params.bibleRules);
    const contextBlock = buildContextBlock(relevantRules, relevantCodex, params.relationships || [], settings.contextDepth);
    systemInstruction = AI_PROMPTS.CHAT.SYSTEM(contextBlock, params.sessionMode);
  }
  // Instruksi khusus pemanggil (mis. protokol blok codex-draft Lokakarya) di akhir,
  // setelah instruksi mode — KB tetap di cachedContext sehingga cache-nya tak terpengaruh.
  if (params.extraSystem) {
    systemInstruction += '\n\n' + params.extraSystem;
  }
  const userPromptWithContext = AI_PROMPTS.CHAT.USER(params.message, draftSnippet);

  // Pemangkasan riwayat dilakukan SATU kali di proxy (MAX_PROXY_HISTORY) sebagai gerbang
  // akhir, sekaligus titik breakpoint cache riwayat — jadi jangan memangkas ulang di sini
  // (trim ganda dulu menyesatkan: tampak menyimpan 10, padahal proxy memotong ke 8).

  const controller = new AbortController();
  registerAbort('chat', controller);
  try {
    const res = await callAI({
      systemInstruction,
      cachedContext,
      userPrompt: userPromptWithContext,
      provider: provider,
      history: params.history,
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
  const kbSegments = buildCachedContextSegments(params.bibleRules, params.codexEntries, params.relationships || []);
  // Timeline membantu AI menangkap pelanggaran urutan waktu (peristiwa di luar kronologi).
  // P0/P1: timeline TIDAK dimasukkan ke cachedContext agar segmen KB tetap byte-identik
  // dengan rewrite/chat → cache KB dibagi lintas-aksi DAN antar-bab (cek 5 bab beruntun =
  // 1 tulis + 4 baca, bukan 5 tulis cache buangan). Timeline menyusul di blok instruksi
  // (kecil; story-wide sehingga sering sama antar pemeriksaan bab dalam satu sesi).
  const timelineBlock = params.timelineSummary && params.timelineSummary.trim()
    ? `\n\nSTORY TIMELINE (urutan kronologis peristiwa cerita):\n${params.timelineSummary.trim()}`
    : '';

  let cachedContext: string[] | undefined;
  let systemInstruction: string;
  if (useCaching) {
    cachedContext = kbSegments;
    systemInstruction = AI_PROMPTS.CONSISTENCY.SYSTEM() + timelineBlock;
  } else {
    systemInstruction = AI_PROMPTS.CONSISTENCY.SYSTEM(kbSegments.join('\n\n') + timelineBlock);
  }

  const fullText = params.chapterText || '';
  const truncated = fullText.length > MAX_CONSISTENCY_CHARS;
  const chapterText = truncated ? fullText.slice(0, MAX_CONSISTENCY_CHARS) : fullText;

  const userPrompt = AI_PROMPTS.CONSISTENCY.USER(params.chapterTitle || '', chapterText);

  // Kunci abort terpisah (mis. 'consistency-inline') agar pengecekan inline & panel
  // tak saling membatalkan. Label actionType callAI tetap 'consistency' (routing
  // model analitis + logging sama).
  const abortKey = params.actionType || 'consistency';
  const controller = new AbortController();
  registerAbort(abortKey, controller);
  try {
    const res = await callAI({
      systemInstruction,
      cachedContext,
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
    unregisterAbort(abortKey, controller);
  }
}

/** Satu temuan audit konsistensi untuk SATU entri Codex (lapis 1: vs lore terstruktur). */
export interface CodexAuditFinding {
  severity: 'high' | 'medium' | 'low';
  type: string;
  issue: string;
  conflictsWith?: string;
  suggestion?: string;
}

function sanitizeAuditFinding(raw: any): CodexAuditFinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const issue = typeof raw.issue === 'string' ? raw.issue.trim() : '';
  if (!issue) return null; // tanpa deskripsi masalah, temuan tak bermakna
  const severity = ['high', 'medium', 'low'].includes(raw.severity) ? raw.severity : 'medium';
  return {
    severity,
    type: typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : 'Lainnya',
    issue: issue.slice(0, 1000),
    conflictsWith: typeof raw.conflictsWith === 'string' ? raw.conflictsWith.trim().slice(0, 500) : undefined,
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion.trim().slice(0, 1000) : undefined,
  };
}

export interface CodexAuditParams {
  entry: { name: string; category: string; aliases?: string[]; description: string };
  codexEntries: CodexEntry[];
  bibleRules: StoryBibleRule[];
  relationships?: Relationship[];
  /**
   * LAPIS 2: cuplikan prosa bab tempat entitas muncul. Bila diisi, audit
   * membandingkan entri vs prosa (kontradiksi penampilan/perilaku/fakta),
   * bukan sekadar vs lore terstruktur.
   */
  chapterExcerpts?: string;
  provider?: string;
  onRetry?: (attempt: number, error: any, provider: string) => void;
}

/**
 * Audit konsistensi satu entri Codex.
 * - LAPIS 1 (default): entri vs SELURUH knowledge base terstruktur (Bible+Codex+relasi).
 * - LAPIS 2 (bila `chapterExcerpts` diisi): entri vs prosa bab tempat entitas muncul.
 * Abort key terpisah ('codex-audit') agar tak saling batal dengan audit bab.
 */
export async function auditCodexEntry(params: CodexAuditParams): Promise<CodexAuditFinding[]> {
  const settings = getSettings();
  const provider = params.provider || settings.provider;
  const deep = !!params.chapterExcerpts?.trim();

  const useCaching = isCacheSupported(provider) && settings.contextDepth !== 'minimal';
  const kbSegments = buildCachedContextSegments(params.bibleRules, params.codexEntries, params.relationships || []);
  const prompt = deep ? AI_PROMPTS.AUDIT_CODEX_DEEP : AI_PROMPTS.AUDIT_CODEX;

  let cachedContext: string[] | undefined;
  let systemInstruction: string;
  if (useCaching) {
    cachedContext = kbSegments;
    systemInstruction = prompt.SYSTEM();
  } else {
    systemInstruction = prompt.SYSTEM(kbSegments.join('\n\n'));
  }

  const userPrompt = deep
    ? AI_PROMPTS.AUDIT_CODEX_DEEP.USER(params.entry, params.chapterExcerpts!.trim())
    : AI_PROMPTS.AUDIT_CODEX.USER(params.entry);

  const controller = new AbortController();
  registerAbort('codex-audit', controller);
  try {
    const res = await callAI({
      systemInstruction,
      cachedContext,
      userPrompt,
      provider,
      temperature: 0.2, // analitis: minim kreativitas
      maxTokens: deep ? 2000 : 1500,
      signal: controller.signal,
      actionType: 'consistency',
      cacheable: useCaching,
      onRetry: params.onRetry,
    });
    return parseJsonArray(res)
      .map(sanitizeAuditFinding)
      .filter((f): f is CodexAuditFinding => f !== null);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'Audit entri Codex gagal.', 'API_ERROR');
  } finally {
    unregisterAbort('codex-audit', controller);
  }
}

const ENRICH_CATEGORIES = new Set(['character', 'location', 'item', 'magic', 'event', 'other']);

export interface EnrichedEntity {
  name: string;
  category: string;
  description: string;
  aliases: string[];
}

/**
 * Enrichment Codex berbasis manuskrip (grounded): diberi daftar entitas + cuplikan
 * konteksnya, AI mengembalikan kategori + deskripsi + alias yang SETIA pada teks.
 * Dirutekan ke model murah (actionType 'extract') dan dipakai on-demand saja.
 * Mode batch (banyak entitas sekaligus) mengamortisasi system prompt → hemat token.
 */
export async function enrichEntities(
  items: { name: string; excerpts: string }[],
  bibleRules: StoryBibleRule[]
): Promise<EnrichedEntity[]> {
  if (!items || items.length === 0) return [];
  const settings = getSettings();
  const contextBlock = buildContextBlock(bibleRules, [], [], settings.contextDepth);
  const systemInstruction = AI_PROMPTS.ENRICH_CODEX.SYSTEM(contextBlock);
  const userPrompt = AI_PROMPTS.ENRICH_CODEX.USER(items);
  // Plafon output skala jumlah entitas (jaring pengaman), dengan lantai & langit.
  const maxTokens = Math.min(4000, Math.max(600, items.length * 220 + 400));

  // Cocokkan nama hasil ke nama yang diminta (case-insensitive) agar key konsisten.
  const requestedByLower = new Map(items.map(it => [it.name.toLowerCase(), it.name]));

  try {
    const res = await callAI({ systemInstruction, userPrompt, temperature: 0.3, maxTokens, actionType: 'extract' });
    const arr = parseJsonArray(res);
    const out: EnrichedEntity[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const rawName = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!rawName) continue;
      const name = requestedByLower.get(rawName.toLowerCase()) || rawName;
      const category = ENRICH_CATEGORIES.has(raw.category) ? raw.category : 'other';
      const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 1000) : '';
      const aliases = Array.isArray(raw.aliases)
        ? raw.aliases.filter((a: any) => typeof a === 'string' && a.trim()).map((a: string) => a.trim()).slice(0, 10)
        : [];
      out.push({ name, category, description, aliases });
    }
    return out;
  } catch (error: any) {
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'Enrichment entitas gagal.', 'API_ERROR');
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

