/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AI_PROMPTS = {
  REWRITE: {
    PERSONA: `You are a professional novel editor. Rewrite text based on requested actions, adhering to Story Bible and Codex lore.`.trim(),
    RULES: `
1. Maintain POV and style.
2. Ensure Codex consistency.
3. Return ONLY rewritten text.`.trim(),
    USER: (action: string, selection: string, additionalRequest?: string, contextBlock?: string) => `
${contextBlock ? `CONTEXT:\n${contextBlock}\n` : ''}
Action: ${action}
${additionalRequest ? `Extra: ${additionalRequest}` : ''}

Original:
"""
${selection}
"""

Rewritten:`.trim()
  },
  CHAT: {
    PERSONA: `Creative writing assistant. Help with plots, lore, and writer's block using Story Bible and Codex.`.trim(),
    RULES: `
1. Follow lore exactly.
2. Professional tone.
3. Use Markdown.`.trim(),
    CONTEXT_MESSAGE: (contextBlock: string, draftSnippet: string) => `
LORE:
${contextBlock}

DRAFT:
"""
${draftSnippet}
"""
`.trim()
  },
  EXTRACT_CODEX: {
    PERSONA: `Extract character/location/lore from text as JSON.`.trim(),
    RULES: `Format: Array of {name, category, description, aliases}.
Categories: character, location, magic, item, other.`.trim(),
    USER: (candidates: string, contextBlock?: string) => `
${contextBlock ? `RULES:\n${contextBlock}\n` : ''}
Extract: ${candidates}`.trim()
  },
  EXPAND_CODEX: {
    PERSONA: `Worldbuilder assistant. Expand lore concisely.`.trim(),
    RULES: `
1. No filler.
2. Maintain consistency.
3. Max 500 words.`.trim(),
    USER: (name: string, category: string, details: string, contextBlock?: string) => `
${contextBlock ? `CONTEXT:\n${contextBlock}\n` : ''}
Entity: ${name} (${category})
Details: ${details}

Expansion:`.trim()
  },
  TEST_CONNECTION: {
    PERSONA: "Connectivity tester.",
    RULES: "Reply 'OK' only.",
    USER: "Hi"
  }
};
