import { StoryBibleRule, CodexEntry } from "../../types";
import { getRelevantContext, getRelevantBibleRules } from "../contextEngine";
import { callGemini } from "./gemini";
import { callProxy } from "./proxy";
import { GenerateParams, ChatParams, AIRenderParams } from "./types";

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
  
  try {
    // Inject custom model if available for the provider
    if (!params.model) {
      params.model = settings.models[settings.provider as keyof typeof settings.models];
    }

    // Prefer proxy for all providers to hide keys if possible and avoid CORS
    return await callProxy(settings.provider, params, settings.keys[settings.provider as keyof typeof settings.keys]);
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    throw new AIError(error.message || 'AI processing failed', 'API_ERROR');
  }
}

function extractCandidateSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const candidates = sentences.filter(s => /\b[A-Z][a-z]{2,}/.test(s));
  return candidates.slice(0, 60).join(' ');
}

// Facade Methods

export async function processRewrite(params: GenerateParams): Promise<string> {
  const relevantCodex = getRelevantContext(params.selection, params.codexEntries);
  const relevantRules = getRelevantBibleRules(params.selection, params.bibleRules);

  const systemInstruction = `
You are a professional novel editor and writing assistant. 
Your goal is to rewrite the text provided based on the specific action requested, while strictly adhering to the Story Bible and maintaining consistency with the character/world lore (Codex).

${buildContextBlock(relevantRules, relevantCodex)}

GUIDELINES:
1. Maintain the existing point of view and style unless the Story Bible says otherwise.
2. Ensure technical consistency with the Codex.
3. Be evocative and professional.
4. ONLY return the rewritten text. No preamble, no commentary.
`.trim();

  const userPrompt = `
Action: ${params.action}
${params.prompt ? `Additional Request: ${params.prompt}` : ''}

Original Text to Rewrite:
"""
${params.selection}
"""

Rewritten Text:
`.trim();

  try {
    const controller = new AbortController();
    abortControllers.set('rewrite', controller);
    
    const res = await callAI({
      systemInstruction,
      userPrompt,
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
  const relevantCodex = getRelevantContext(contextSource, params.codexEntries);
  const relevantRules = getRelevantBibleRules(contextSource, params.bibleRules);

  const systemInstruction = `
You are a brilliant developmental editor and creative writing assistant.
The user is writing a novel. You act as their sounding board, lore-keeper, and brainstorming partner.

${buildContextBlock(relevantRules, relevantCodex)}

CURRENT CHAPTER DRAFT:
"""
${params.contextText?.substring(0, 2000)}
"""

Answer the user's questions, suggest plots, or help them break writer's block based on their worldbuilding. Format your answers clearly using Markdown.
`.trim();

  try {
    const controller = new AbortController();
    abortControllers.set('chat', controller);
    
    const res = await callAI({
      systemInstruction,
      userPrompt: params.message,
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
  const systemInstruction = `
You are an expert worldbuilder assistant. Your job is to extract character, location, or lore information from the text provided and format it as JSON.
Format: Array of {name, category, description, aliases}.
Categories: character, location, magic, item, other.

${buildContextBlock(bibleRules, [])}
`.trim();

  const userPrompt = `Extract codex entries from: ${extractCandidateSentences(text)}`;

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
    throw new AIError('Failed to extract codex entries.', 'PARSE_ERROR');
  }
}

export async function expandCodexEntry(
  name: string,
  category: string,
  currentDescription: string,
  bibleRules: StoryBibleRule[]
): Promise<string> {
  const systemInstruction = `
You are an expert worldbuilder. Expand this lore entry vividly.
Maintain consistency with the project's overall rules and style.

${buildContextBlock(bibleRules, [])}
`.trim();

  const userPrompt = `Entity: ${name}\nCategory: ${category}\nDetails: ${currentDescription}`;
  
  return await callAI({ systemInstruction, userPrompt, temperature: 0.9 });
}

export async function testConnection(provider: string, apiKey: string): Promise<boolean> {
  try {
    const params: AIRenderParams = {
      systemInstruction: "You are a connectivity tester. Reply only with 'OK'.",
      userPrompt: "Hi",
      temperature: 0.1
    };

    let result = '';
    result = await callProxy(provider, params, apiKey);
    
    return result.includes('OK') || result.length > 0;
  } catch (error) {
    console.error(`Connection test failed for ${provider}:`, error);
    throw error;
  }
}
