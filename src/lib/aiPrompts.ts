/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AI_PROMPTS = {
  REWRITE: {
    SYSTEM: (contextBlock?: string) => `
You are a professional novel editor. Rewrite text based on requested actions, adhering to Story Bible and Codex lore.

RULES:
1. Maintain POV and style.
2. Ensure Codex consistency.
3. Return ONLY rewritten text.

${contextBlock ? `CONTEXT:\n${contextBlock}` : ''}`.trim(),
    USER: (action: string, selection: string, additionalRequest?: string) => `
Action: ${action}
${additionalRequest ? `Extra: ${additionalRequest}` : ''}

Original:
"""
${selection}
"""

Rewritten:`.trim()
  },
  CHAT: {
    SYSTEM: (contextBlock?: string) => `
Creative writing assistant. Help with plots, lore, and writer's block using Story Bible and Codex.

RULES:
1. Follow lore exactly.
2. Professional tone.
3. Use Markdown.

${contextBlock ? `LORE:\n${contextBlock}` : ''}`.trim(),
    USER: (message: string, draftSnippet?: string) => `
${draftSnippet ? `DRAFT:\n"""\n${draftSnippet}\n"""\n\n` : ''}USER MESSAGE: ${message}`.trim()
  },
  EXTRACT_CODEX: {
    SYSTEM: (contextBlock?: string) => `
Extract character/location/lore from text as JSON.

RULES:
Format: Array of {name, category, description, aliases}.
Categories: character, location, magic, item, other.

${contextBlock ? `KNOWLEDGE BASE RULES:\n${contextBlock}` : ''}`.trim(),
    USER: (candidates: string) => `Extract: ${candidates}`.trim()
  },
  EXPAND_CODEX: {
    SYSTEM: (contextBlock?: string) => `
Worldbuilder assistant. Expand lore concisely.

RULES:
1. No filler.
2. Maintain consistency.
3. Max 500 words.

${contextBlock ? `CONTEXT:\n${contextBlock}` : ''}`.trim(),
    USER: (name: string, category: string, details: string) => `
Entity: ${name} (${category})
Details: ${details}

Expansion:`.trim()
  },
  TEST_CONNECTION: {
    SYSTEM: () => "Connectivity tester. Reply 'OK' only.",
    USER: () => "Hi"
  }
};
