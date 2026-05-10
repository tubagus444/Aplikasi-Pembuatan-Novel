/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { StoryBibleRule, CodexEntry } from "../types";
import { getRelevantContext, getRelevantBibleRules } from "./contextEngine";

export class AIError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AIError';
  }
}

let activeAbortController: AbortController | null = null;

export function cancelAI() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
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

function extractCandidateSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const candidates = sentences.filter(s => /\b[A-Z][a-z]{2,}/.test(s));
  return candidates.slice(0, 60).join(' ');
}

interface GenerateParams {
  prompt: string;
  selection: string;
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  action: string;
}

// Ensure safe lookup of local settings
function getSettings() {
  return {
    provider: localStorage.getItem('ai_provider') || 'google',
    keys: {
      google: localStorage.getItem('ai_key_google') || process.env.GEMINI_API_KEY || '',
      groq: localStorage.getItem('ai_key_groq') || '',
      openrouter: localStorage.getItem('ai_key_openrouter') || '',
      claude: localStorage.getItem('ai_key_claude') || ''
    }
  };
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        // Rate limit
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  throw new AIError("Max retries reached", "API_ERROR");
}

async function callAI(
  systemInstruction: string, 
  userPrompt: string, 
  history?: { role: 'user' | 'model', parts: { text: string }[] }[],
  temperature = 0.7,
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings();
  
  if (settings.provider === 'google') {
    if (!settings.keys.google) throw new AIError("Google AI Studio API key is not set. Please check settings.", "API_KEY_MISSING");
    const ai = new GoogleGenAI({ apiKey: settings.keys.google });
    
    // Convert directly from history + userPrompt
    const mappedContents = history 
      ? [...history.map(c => ({ role: c.role, parts: [{ text: c.parts[0].text }] })), { role: 'user', parts: [{ text: userPrompt }] }]
      : [{ role: 'user', parts: [{ text: userPrompt }] }];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: mappedContents,
      config: {
        systemInstruction,
        temperature,
      },
    });
    return response.text || '';
  }
  
  else if (settings.provider === 'groq') {
    if (!settings.keys.groq) throw new AIError("Groq API key is not set. Please check settings.", "API_KEY_MISSING");
    const messages = [
      { role: "system", content: systemInstruction },
      ...(history || []).map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
      { role: "user", content: userPrompt }
    ];
    
    const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.keys.groq}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature
      }),
      signal
    });
    if (!res.ok) throw new AIError(`Groq API Error: ${await res.text()}`, "API_ERROR");
    const data = await res.json();
    return data.choices[0].message.content;
  }
  
  else if (settings.provider === 'openrouter') {
    if (!settings.keys.openrouter) throw new AIError("OpenRouter API key is not set. Please check settings.", "API_KEY_MISSING");
    const messages = [
      { role: "system", content: systemInstruction },
      ...(history || []).map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
      { role: "user", content: userPrompt }
    ];
    
    const res = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.keys.openrouter}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'Writer Pro'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        temperature
      }),
      signal
    });
    if (!res.ok) throw new AIError(`OpenRouter API Error: ${await res.text()}`, "API_ERROR");
    const data = await res.json();
    return data.choices[0].message.content;
  }
  
  else if (settings.provider === 'claude') {
    if (!settings.keys.claude) throw new AIError("Claude API key is not set. Please check settings.", "API_KEY_MISSING");
    // Claude requires system as a separate param
    const messages = [
      ...(history || []).map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
      { role: "user", content: userPrompt }
    ];
    
    // Warning: typically Claude API from browser fails due to CORS, but since we are replacing it anyway, this is a best-effort template.
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.keys.claude,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: [
          {
            type: 'text',
            text: systemInstruction,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages,
        temperature
      }),
      signal
    });
    if (!res.ok) throw new AIError(`Claude API Error: ${await res.text()}`, "API_ERROR");
    const data = await res.json();
    return data.content[0].text;
  }
  
  throw new AIError("Unknown AI Provider", "API_ERROR");
}

export async function processRewrite({
  prompt,
  selection,
  bibleRules,
  codexEntries,
  action
}: GenerateParams): Promise<string> {
  const contextSource = selection || '';
  const relevantCodex = getRelevantContext(contextSource, codexEntries);
  const relevantRules = getRelevantBibleRules(contextSource, bibleRules);

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
Action: ${action}
${prompt ? `Additional Request: ${prompt}` : ''}

Original Text to Rewrite:
"""
${selection}
"""

Rewritten Text:
`.trim();

  try {
    activeAbortController = new AbortController();
    const res = await callAI(systemInstruction, userPrompt, undefined, 0.85, activeAbortController.signal);
    activeAbortController = null;
    return res;
  } catch (error) {
    activeAbortController = null;
    console.error('AI Error:', error);
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI processing failed. Check your connection.', "API_ERROR");
  }
}

export async function processChat({
  message,
  history,
  bibleRules,
  codexEntries,
  contextText
}: {
  message: string;
  history: { role: 'user' | 'model', parts: { text: string }[] }[];
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  contextText: string;
}): Promise<string> {
  const contextSource = `${contextText || ''} ${message || ''}`;
  const relevantCodex = getRelevantContext(contextSource, codexEntries);
  const relevantRules = getRelevantBibleRules(contextSource, bibleRules);

  const systemInstruction = `
You are a brilliant developmental editor and creative writing assistant.
The user is writing a novel. You act as their sounding board, lore-keeper, and brainstorming partner.

${buildContextBlock(relevantRules, relevantCodex)}

CURRENT CHAPTER DRAFT:
"""
${contextText?.substring(0, 2000)}
"""

Answer the user's questions, suggest plots, or help them break writer's block based on their worldbuilding. Format your answers clearly using Markdown.
`.trim();

  try {
    activeAbortController = new AbortController();
    const res = await callAI(systemInstruction, message, history, 0.7, activeAbortController.signal);
    activeAbortController = null;
    return res;
  } catch (error) {
    activeAbortController = null;
    console.error('AI Chat Error:', error);
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI chat failed.', "API_ERROR");
  }
}

export async function extractToCodex(
  text: string,
  bibleRules: StoryBibleRule[]
): Promise<{name: string, category: string, description: string, aliases: string[]}[]> {
  const contextSource = text || '';
  const relevantRules = getRelevantBibleRules(contextSource, bibleRules);

  const systemInstruction = `
You are an expert worldbuilder assistant. Your job is to extract character, location, or lore information from the text provided by the AI assistant and format it as JSON.
Theme & Constraints for context:
${buildContextBlock(relevantRules, [])}

Return ONLY a valid JSON array of objects, with no markdown formatting or extra text.
Each object MUST have the following keys:
- 'name' (string)
- 'category' (string: one of 'character', 'location', 'magic', 'item', 'other')
- 'description' (string: detailed description extracted/summarized from the text)
- 'aliases' (array of strings: any alternate names mentioned)

Example valid output:
[
  {
    "name": "Eldritch Spire",
    "category": "location",
    "description": "A dark tower overlooking the sea.",
    "aliases": ["The Tall Spire", "Dark Tower"]
  }
]
`.trim();

  const userPrompt = `
Extract codex entries from the following text:
"""
${extractCandidateSentences(text)}
"""
`.trim();

  try {
    activeAbortController = new AbortController();
    const response = await callAI(systemInstruction, userPrompt, undefined, 0.3, activeAbortController.signal);
    activeAbortController = null;
    
    // basic cleanup just in case there's markdown wrapping
    let textData = response.replace(/^```json/m, '').replace(/^```/m, '').trim();
    const startIdx = textData.indexOf('[');
    const endIdx = textData.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      textData = textData.substring(startIdx, endIdx + 1);
    }
    
    try {
      return JSON.parse(textData);
    } catch(e) {
      throw new AIError('AI returned invalid JSON format. Please try again.', 'PARSE_ERROR');
    }
  } catch (error) {
    activeAbortController = null;
    console.error('AI Codex Extraction Error:', error);
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI extraction failed.', "API_ERROR");
  }
}

export async function expandCodexEntry(
  name: string,
  category: string,
  currentDescription: string,
  bibleRules: StoryBibleRule[]
): Promise<string> {
  const contextSource = currentDescription || '';
  const relevantRules = getRelevantBibleRules(contextSource, bibleRules);

  const systemInstruction = `
You are an expert worldbuilder and novelist. Expand the lore entry for a story element.
Theme & Constraints:
${buildContextBlock(relevantRules, [])}

Guidelines:
1. Provide a detailed, vivid, and structured description based on the initial input.
2. If it is a character, consider appearance, backstory, personality, and motivations.
3. If it is a location, consider geography, culture, atmosphere, and history.
4. Keep the output in a clean, readable format (markdown is okay, but avoid overly complex formats).
5. DO NOT completely overwrite existing context, synthesize and expand upon it.
6. Return ONLY the expanded description. Let your creativity run wild based on the provided hint.
`.trim();

  const userPrompt = `
Entity Name: ${name}
Category: ${category}
Current/Short Info: ${currentDescription || 'No initial info provided. Come up with something creative based on the name and category.'}

Please expand this entry into a rich, detailed lore description suitable for a story codex.
`.trim();

  try {
    activeAbortController = new AbortController();
    const res = await callAI(systemInstruction, userPrompt, undefined, 0.9, activeAbortController.signal);
    activeAbortController = null;
    return res;
  } catch (error) {
    activeAbortController = null;
    console.error('AI Expansion Error:', error);
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error ? error.message : 'AI expansion failed.', "API_ERROR");
  }
}
