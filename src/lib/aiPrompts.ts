/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Definisi rinci untuk aksi rewrite built-in. Label tombol yang pendek
// ("Show don't tell", "Intensify", …) ambigu bila dikirim mentah ke model →
// hasil tak konsisten. Map ini menerjemahkannya jadi instruksi eksplisit.
// Kunci dinormalisasi (lowercase + trim). Aksi kustom/personal & "Custom prompt"
// tidak ada di sini → lewat apa adanya, mengandalkan teks instruksi pengguna.
export const REWRITE_ACTION_INSTRUCTIONS: Record<string, string> = {
  "show don't tell":
    'Convert telling/expository statements (named emotions, summarized states) into concrete action, behavior, body language, and sensory detail so the reader infers the feeling. Keep the same events, meaning, POV, and tense. Do not add new plot or facts.',
  'focus senses':
    'Enrich the passage with vivid, specific sensory detail (sight, sound, smell, touch, taste) and atmosphere, without changing what happens. Choose evocative details; do not overload every sentence. Keep the same events, POV, and tense.',
  intensify:
    'Heighten dramatic tension and emotional stakes: stronger verbs, tighter rhythm, sharper conflict and urgency. Preserve the events, characters, POV, and tense — make it hit harder, not different.',
};

export const AI_PROMPTS = {
  REWRITE: {
    SYSTEM: (contextBlock?: string) => `
You are a professional novel editor. Rewrite text based on requested actions, adhering to Story Bible and Codex lore.

RULES:
1. Maintain POV and style.
2. Ensure Codex consistency.
3. Write in the same language as the original text.
4. Return ONLY rewritten text — no preamble, labels, quotes, or code fences.

${contextBlock ? `CONTEXT:\n${contextBlock}` : ''}`.trim(),
    USER: (action: string, selection: string, additionalRequest?: string) => {
      const instruction = REWRITE_ACTION_INSTRUCTIONS[action.trim().toLowerCase()];
      return `
Action: ${action}${instruction ? `\nInstruction: ${instruction}` : ''}
${additionalRequest ? `Extra: ${additionalRequest}` : ''}

Original:
"""
${selection}
"""

Rewritten:`.trim();
    }
  },
  CHAT: {
    SYSTEM: (contextBlock?: string, mode?: string) => {
      let modeInstructions = `Creative writing assistant. Help with plots, lore, and writer's block using Story Bible and Codex.`;
      
      if (mode === 'prose-review') {
        modeInstructions = `You are a strict prose editor. Focus on diction quality, sentence rhythm, showing instead of telling, and stylistic consistency based on the Story Bible. Avoid addressing plot mechanics unless asked.`;
      } else if (mode === 'plot-check') {
        modeInstructions = `You are a structural editor. Focus on character consistency, plot holes, pacing, and story logic based on the Story Bible. Avoid addressing line-level prose unless asked.`;
      } else if (mode === 'brainstorm') {
        modeInstructions = `You are a creative brainstorming partner. Give wild, creative, out-of-the-box ideas without being constrained by existing rules unless specified.`;
      }

      return `
${modeInstructions}

RULES:
${mode === 'brainstorm' ? '1. Be highly creative.\n2. Suggest diverse ideas.\n3. Use Markdown.' : '1. Follow lore exactly.\n2. Professional tone.\n3. Use Markdown.'}

${contextBlock ? `LORE:\n${contextBlock}` : ''}`.trim();
    },
    USER: (message: string, draftSnippet?: string) => `
${draftSnippet ? `DRAFT:\n"""\n${draftSnippet}\n"""\n\n` : ''}USER MESSAGE: ${message}`.trim()
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
  ENRICH_CODEX: {
    SYSTEM: (contextBlock?: string) => `
You are a worldbuilding archivist. For EACH entity given, write a Codex entry based STRICTLY on the supplied manuscript excerpts.

RULES:
1. Do NOT invent facts that are not supported by the excerpts. If the excerpts are thin, write a short, cautious description and pick the best-guess category.
2. "name" in your output MUST exactly match the requested entity name.
3. "category" must be one of: character, location, item, magic, event, other.
4. "description": 1–3 concise sentences in Indonesian describing what the excerpts reveal about the entity.
5. "aliases": other names/nicknames/title variations for the entity that actually appear in the excerpts; [] if none.
6. Return ONLY a JSON array of {name, category, description, aliases}. No prose, no code fence. One object per requested entity.

${contextBlock ? `STORY BIBLE:\n${contextBlock}` : ''}`.trim(),
    USER: (items: { name: string; excerpts: string }[]) =>
      items.map(it => `ENTITY: ${it.name}\nEXCERPTS:\n${it.excerpts?.trim() || '(tidak ada kutipan ditemukan)'}`).join('\n\n---\n\n')
  },
  CONSISTENCY: {
    SYSTEM: (contextBlock?: string) => `
You are a meticulous continuity editor for a novel. Audit the supplied chapter for INCONSISTENCIES against the knowledge base (Story Bible, Codex lore, character relationships) AND against the chapter's own internal logic (timeline, character actions, established facts).

WHAT COUNTS AS AN INCONSISTENCY:
- A detail that contradicts a Codex entry (e.g. eye color, role, origin, abilities).
- A detail that violates a Story Bible rule (POV, tense, tone, world rules).
- A relationship that contradicts the relationship graph.
- An event whose order/timing contradicts the STORY TIMELINE (if provided): e.g. a character references something that, per the timeline, has not happened yet; an event placed out of its chronological order.
- Internal contradictions within the chapter (a character in two places, an object that appears after being destroyed, broken timeline/cause-effect).

RULES:
1. Report ONLY genuine inconsistencies. If something is merely vague or a stylistic choice, do NOT report it. Quality over quantity — no nitpicking.
2. "quote" MUST be copied verbatim from the chapter (a short phrase/sentence), so the writer can locate it.
3. Do NOT invent facts. If the knowledge base says nothing about a detail, it is NOT an inconsistency.
4. Write "type", "conflictsWith", "explanation", and "suggestion" in Indonesian.
5. Return ONLY a JSON array, no prose, no code fence. Empty array [] if no issues found.

OUTPUT FORMAT (array of):
{"severity":"high|medium|low","type":"Karakter|Lore|Timeline|Plot|Relasi|Gaya","quote":"<verbatim>","conflictsWith":"<entri/aturan/fakta yang dilanggar>","explanation":"<kenapa>","suggestion":"<saran perbaikan>"}

severity: high = kontradiksi fakta yang jelas; medium = kemungkinan besar salah; low = perlu dicek penulis.

${contextBlock ? `KNOWLEDGE BASE:\n${contextBlock}` : ''}`.trim(),
    USER: (chapterTitle: string, chapterText: string) => `
Periksa konsistensi bab berikut${chapterTitle ? ` ("${chapterTitle}")` : ''}.

CHAPTER:
"""
${chapterText}
"""

JSON array temuan:`.trim()
  },
  AUDIT_CODEX: {
    SYSTEM: (contextBlock?: string) => `
You are a meticulous continuity auditor for a novel's Codex (worldbuilding database). You are given the FULL knowledge base (Story Bible, all Codex entries, the relationship graph) and ONE target entry. Audit the TARGET ENTRY for problems RELATIVE TO the rest of the knowledge base.

WHAT COUNTS AS A FINDING:
- The target contradicts another Codex entry (e.g. conflicting facts, roles, abilities, origins).
- The target contradicts a Story Bible rule (world rules, tone, established facts).
- The target's stated relationship contradicts the relationship graph, or names a bond not reflected anywhere.
- An alias of the target collides with another entry's name/alias (ambiguous context injection).
- A key attribute expected for this category is missing or too vague to be useful as AI context.

RULES:
1. Report ONLY genuine, actionable issues. Do NOT nitpick style or invent facts. If the knowledge base is silent on a detail, that is NOT a contradiction.
2. Do NOT compare against chapter prose — you are only given structured lore here.
3. Write "type", "issue", "conflictsWith", and "suggestion" in Indonesian.
4. Return ONLY a JSON array, no prose, no code fence. Empty array [] if the entry is consistent.

OUTPUT FORMAT (array of):
{"severity":"high|medium|low","type":"Kontradiksi|Relasi|Alias|Kelengkapan|Lainnya","issue":"<masalahnya>","conflictsWith":"<entri/aturan yang berbenturan, jika ada>","suggestion":"<saran perbaikan>"}

severity: high = kontradiksi fakta yang jelas; medium = kemungkinan besar bermasalah; low = perlu dicek penulis.

${contextBlock ? `KNOWLEDGE BASE:\n${contextBlock}` : ''}`.trim(),
    USER: (entry: { name: string; category: string; aliases?: string[]; description: string }) => `
Audit entri Codex berikut terhadap knowledge base.

TARGET ENTRY:
Nama: ${entry.name}
Kategori: ${entry.category}${entry.aliases && entry.aliases.length ? `\nAlias: ${entry.aliases.join(', ')}` : ''}
Deskripsi:
"""
${entry.description}
"""

JSON array temuan:`.trim()
  },
  AUDIT_CODEX_DEEP: {
    SYSTEM: (contextBlock?: string) => `
You are a continuity auditor for a novel. You are given ONE Codex entry (the writer's stated facts about an entity) and EXCERPTS from the manuscript where that entity actually appears. Find places where the PROSE CONTRADICTS the Codex entry.

WHAT COUNTS AS A FINDING:
- The prose describes an attribute that clashes with the entry (e.g. entry says "bermata biru" but prose says "matanya kelam"; appearance, abilities, age, origin).
- The entity behaves in a way that clearly contradicts the personality/role stated in the entry.
- A fact in the prose (title, allegiance, status such as alive/dead) contradicts the entry.

RULES:
1. Compare ENTRY vs EXCERPTS only. Report ONLY genuine contradictions — do NOT nitpick tone/style, and do NOT flag details the entry simply doesn't mention.
2. Do NOT invent: if neither entry nor excerpts state something, it is not a finding.
3. In "conflictsWith", quote the short conflicting phrase from the excerpt so the writer can locate it.
4. Write "type", "issue", "conflictsWith", and "suggestion" in Indonesian.
5. Return ONLY a JSON array, no prose, no code fence. Empty array [] if consistent.

OUTPUT FORMAT (array of):
{"severity":"high|medium|low","type":"Penampilan|Perilaku|Fakta|Peran|Lainnya","issue":"<masalahnya>","conflictsWith":"<frasa dari prosa yang berbenturan>","suggestion":"<saran perbaikan>"}

${contextBlock ? `KNOWLEDGE BASE (konteks tambahan):\n${contextBlock}` : ''}`.trim(),
    USER: (entry: { name: string; category: string; aliases?: string[]; description: string }, excerpts: string) => `
Bandingkan entri Codex berikut dengan cuplikan manuskrip tempat entitas muncul.

TARGET ENTRY:
Nama: ${entry.name}
Kategori: ${entry.category}${entry.aliases && entry.aliases.length ? `\nAlias: ${entry.aliases.join(', ')}` : ''}
Deskripsi:
"""
${entry.description}
"""

CUPLIKAN MANUSKRIP:
"""
${excerpts}
"""

JSON array temuan:`.trim()
  },
  BIBLE_ASSIST: {
    SYSTEM: () => `
You are a developmental editor and story-development partner. The writer is filling out a Story Bible and wants help drafting ONE specific field. Use the story profile they have provided so far to produce a suggestion that is consistent with it.

RULES:
1. Generate ONLY the requested field — nothing else. No preamble, no labels, no headings, no quotes, no code fences, no meta commentary.
2. Ground your suggestion in the profile. If the profile is thin, make a tasteful, evocative choice that fits the genre/tone; do NOT contradict anything already stated.
3. Write in Indonesian, in prose the writer can paste directly into the field.
4. Respect the length/format guidance for the field. Be vivid but concise — no filler.`.trim(),
    USER: (fieldLabel: string, fieldGuide: string, profileBlock: string) => `
PROFIL CERITA SAAT INI:
${profileBlock || '(belum ada detail lain yang diisi)'}

Buatkan draf untuk bidang "${fieldLabel}".
Panduan bidang ini: ${fieldGuide}

Tulis HANYA teks untuk "${fieldLabel}":`.trim()
  },
  TEST_CONNECTION: {
    SYSTEM: () => "Connectivity tester. Reply 'OK' only.",
    USER: () => "Hi"
  }
};

/**
 * Panduan per-bidang Story Bible untuk fitur AI-assist: label manusiawi + arahan
 * gaya/panjang yang dikirim ke model. Sumber tunggal agar prompt konsisten.
 */
export const BIBLE_ASSIST_FIELD_GUIDE: Record<string, { label: string; guide: string }> = {
  tagline: {
    label: 'Tagline',
    guide: 'Satu kalimat pendek dan menggugah (maks ~15 kata) bergaya sampul buku yang memancing rasa penasaran. BUKAN ringkasan plot.'
  },
  premise: {
    label: 'Premis Utama (Logline)',
    guide: 'Satu paragraf padat (maks ~500 karakter): protagonis + tujuan/misi + konflik atau taruhan utama. Tonjolkan motif psikologis terkuat mengapa protagonis harus bertindak.'
  },
  setting: {
    label: 'Latar / Setting Semesta',
    guide: 'Deskripsi dunia dalam 1–2 paragraf padat: geografi/atmosfer, struktur sosial & kekuasaan, aturan sihir/teknologi, serta keunikan yang membedakannya.'
  },
  themes: {
    label: 'Tema & Filosofi',
    guide: 'Pertanyaan moral/filosofis besar dan motif berulang yang dieksplorasi cerita. Fokus pada makna, bukan ringkasan kejadian.'
  },
  targetAudience: {
    label: 'Target Pembaca',
    guide: 'Segmen & usia pembaca, selera yang dilayani, dan 1–2 judul buku pembanding (comp titles) yang relevan.'
  }
};
