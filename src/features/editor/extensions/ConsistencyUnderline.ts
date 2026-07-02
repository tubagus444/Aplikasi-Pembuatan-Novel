import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { getCodexMatches } from '@/src/services/contextEngine';
import { InlineConsistencyFlag, InlineQuoteFinding, InlineSpellingFinding, InlineGlossaryFinding } from '@/src/lib/inlineConsistency';

/**
 * Konsistensi inline — plumbing garis bawah di editor.
 *
 * Dua sumber dekorasi memakai plumbing yang sama:
 *   • DETERMINISTIK (Fase 1) — `getFlags`: codexId → flag. Menggarisbawahi
 *     kemunculan nama karakter (posisi via getCodexMatches/Aho-Corasick).
 *   • AI OPSIONAL (Fase 2) — `getQuoteFindings`: kutipan verbatim yang ditandai
 *     AI. Menggarisbawahi potongan teks itu (warna ungu, dibedakan dari
 *     deterministik). Hanya terisi bila toggle AI inline aktif.
 *   • EJAAN (Buku Gaya) — `getSpellingFindings`: kata yang MIRIP tapi tak persis
 *     nama/alias Codex (kandidat typo). Garis bawah merah PUTUS-PUTUS + saran.
 *     Deterministik, nol token; lihat `src/lib/nameSpelling.ts`.
 *
 * Klik nama (deterministik) membuka Codex; garis bawah AI/ejaan bersifat tooltip.
 */

interface ConsistencyUnderlineOptions {
  getEntries: () => { id?: number; name: string; aliases?: string[] }[];
  getFlags: () => Map<number, InlineConsistencyFlag>;
  getQuoteFindings?: () => InlineQuoteFinding[];
  getSpellingFindings?: () => InlineSpellingFinding[];
  getGlossaryFindings?: () => InlineGlossaryFinding[];
  onOpenCodex?: (entryId: number, event: MouseEvent) => void;
}

const PLUGIN_KEY = new PluginKey('consistencyUnderline');

const SEVERITY_COLOR: Record<InlineConsistencyFlag['severity'], string> = {
  high: '#ef4444',   // merah
  medium: '#f59e0b', // amber
  low: '#0ea5e9',    // biru langit
};

function decoStyle(severity: InlineConsistencyFlag['severity'], ai = false): string {
  const color = ai ? '#8b5cf6' /* ungu: bedakan temuan AI */ : SEVERITY_COLOR[severity];
  const base = [
    'text-decoration: underline',
    'text-decoration-style: wavy',
    `text-decoration-color: ${color}`,
    'text-decoration-skip-ink: none',
    'text-underline-offset: 3px',
    'cursor: help',
  ];
  if (ai) base.push('background-color: rgba(139, 92, 246, 0.08)');
  return base.join('; ');
}

/** Gaya garis bawah untuk kandidat salah-eja (merah, PUTUS-PUTUS → beda dari wavy). */
function spellingStyle(): string {
  return [
    'text-decoration: underline',
    'text-decoration-style: dashed',
    'text-decoration-color: #ef4444',
    'text-decoration-skip-ink: none',
    'text-underline-offset: 3px',
    'cursor: help',
  ].join('; ');
}

/** Gaya garis bawah untuk temuan Glosarium (teal, PUTUS-PUTUS → beda dari nama). */
function glossaryStyle(): string {
  return [
    'text-decoration: underline',
    'text-decoration-style: dashed',
    'text-decoration-color: #14b8a6',
    'text-decoration-skip-ink: none',
    'text-underline-offset: 3px',
    'cursor: help',
  ].join('; ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Dekorasi kandidat salah-eja nama — pencarian kata utuh (case-sensitive). */
function buildSpellingDecorations(doc: PMNode, findings: InlineSpellingFinding[]): Decoration[] {
  const decorations: Decoration[] = [];
  for (const f of findings) {
    const word = (f.word || '').trim();
    if (word.length < 3) continue;
    let regex: RegExp;
    try {
      // \b batas kata; case-sensitive agar hanya kemunculan yang persis salah eja ditandai.
      regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
    } catch {
      continue;
    }
    let occurrences = 0;
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text || occurrences >= 20) return;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(node.text)) !== null && occurrences < 20) {
        const start = pos + m.index;
        const end = start + m[0].length;
        if (start < doc.content.size && end <= doc.content.size) {
          decorations.push(
            Decoration.inline(start, end, {
              nodeName: 'span',
              class: 'consistency-underline consistency-spelling',
              style: spellingStyle(),
              title: `Kemungkinan salah eja — maksudmu "${f.suggestion}"?`,
            })
          );
          occurrences++;
        }
        if (m.index === regex.lastIndex) regex.lastIndex++;
      }
    });
  }
  return decorations;
}

/** Dekorasi temuan Glosarium — pencarian kata/frasa utuh (case-insensitive). */
function buildGlossaryDecorations(doc: PMNode, findings: InlineGlossaryFinding[]): Decoration[] {
  const decorations: Decoration[] = [];
  for (const f of findings) {
    const word = (f.word || '').trim();
    if (word.length < 2) continue;
    let regex: RegExp;
    try {
      // Case-insensitive: ejaan tak baku bisa muncul dalam berbagai kapitalisasi.
      regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
    } catch {
      continue;
    }
    const title = f.kind === 'variant'
      ? `Istilah tak baku — gunakan "${f.suggestion}"`
      : `Kemungkinan salah eja istilah — maksudmu "${f.suggestion}"?`;
    let occurrences = 0;
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text || occurrences >= 20) return;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(node.text)) !== null && occurrences < 20) {
        const start = pos + m.index;
        const end = start + m[0].length;
        if (start < doc.content.size && end <= doc.content.size) {
          decorations.push(
            Decoration.inline(start, end, {
              nodeName: 'span',
              class: 'consistency-underline consistency-glossary',
              style: glossaryStyle(),
              title,
            })
          );
          occurrences++;
        }
        if (m.index === regex.lastIndex) regex.lastIndex++;
      }
    });
  }
  return decorations;
}

/** Dekorasi berbasis kutipan verbatim (temuan AI) — pencarian literal di dokumen. */
function buildQuoteDecorations(doc: PMNode, findings: InlineQuoteFinding[]): Decoration[] {
  const decorations: Decoration[] = [];
  for (const f of findings) {
    const quote = (f.quote || '').trim();
    if (quote.length < 3) continue;
    let regex: RegExp;
    try {
      regex = new RegExp(escapeRegExp(quote), 'gi');
    } catch {
      continue;
    }
    let occurrences = 0;
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text || occurrences >= 10) return;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(node.text)) !== null && occurrences < 10) {
        const start = pos + m.index;
        const end = start + m[0].length;
        if (start < doc.content.size && end <= doc.content.size) {
          decorations.push(
            Decoration.inline(start, end, {
              nodeName: 'span',
              class: 'consistency-underline consistency-ai',
              style: decoStyle(f.severity, true),
              title: f.message,
            })
          );
          occurrences++;
        }
        if (m.index === regex.lastIndex) regex.lastIndex++; // jaga match nol-panjang
      }
    });
  }
  return decorations;
}

export const ConsistencyUnderline = Extension.create<ConsistencyUnderlineOptions>({
  name: 'consistencyUnderline',

  addOptions() {
    return {
      getEntries: () => [],
      getFlags: () => new Map(),
      getQuoteFindings: () => [],
      getSpellingFindings: () => [],
      getGlossaryFindings: () => [],
      onOpenCodex: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    let debounceTimer: any = null;
    // Penanda generasi: hasil run yang sudah usang (ada perubahan lebih baru saat
    // getCodexMatches in-flight) tidak boleh di-dispatch — cegah kedip ke posisi lama.
    let runGeneration = 0;

    return [
      new Plugin({
        key: PLUGIN_KEY,
        state: {
          init() {
            return { decorations: DecorationSet.empty, needsUpdate: true };
          },
          apply(tr, value) {
            const next = tr.getMeta('updateConsistencyDecos');
            if (next) {
              return { decorations: next, needsUpdate: false };
            }
            if (tr.getMeta('forceUpdateConsistency')) {
              return { decorations: value.decorations.map(tr.mapping, tr.doc), needsUpdate: true };
            }
            if (tr.docChanged) {
              return { decorations: value.decorations.map(tr.mapping, tr.doc), needsUpdate: true };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state).decorations;
          },
          handleDOMEvents: {
            click(view, event) {
              const target = event.target as HTMLElement;
              if (target && target.classList.contains('consistency-underline')) {
                const id = target.getAttribute('data-codex-id');
                if (id && options.onOpenCodex) {
                  options.onOpenCodex(Number(id), event);
                  return true;
                }
              }
              return false;
            },
          },
        },
        view() {
          return {
            update(view) {
              const pluginState = PLUGIN_KEY.getState(view.state);
              if (!pluginState || !pluginState.needsUpdate) return;

              if (debounceTimer) clearTimeout(debounceTimer);
              const myGeneration = ++runGeneration;

              debounceTimer = setTimeout(async () => {
                const flags = options.getFlags();
                const quoteFindings = options.getQuoteFindings?.() ?? [];
                const spellingFindings = options.getSpellingFindings?.() ?? [];
                const glossaryFindings = options.getGlossaryFindings?.() ?? [];
                const entries = options.getEntries();
                const flagged = entries.filter(e => e.id != null && flags.has(e.id!));

                // Dekorasi kutipan AI + ejaan + glosarium (sinkron) dihitung di akhir terhadap doc terkini.
                const dispatchAll = (nameDecos: Decoration[]) => {
                  if (view.isDestroyed || myGeneration !== runGeneration) return;
                  const quoteDecos = buildQuoteDecorations(view.state.doc, quoteFindings);
                  const spellingDecos = buildSpellingDecorations(view.state.doc, spellingFindings);
                  const glossaryDecos = buildGlossaryDecorations(view.state.doc, glossaryFindings);
                  view.dispatch(view.state.tr.setMeta(
                    'updateConsistencyDecos',
                    DecorationSet.create(view.state.doc, [...nameDecos, ...quoteDecos, ...spellingDecos, ...glossaryDecos])
                  ));
                };

                if (flagged.length === 0) {
                  dispatchAll([]);
                  return;
                }

                const chunks: { pos: number; text: string }[] = [];
                view.state.doc.descendants((node, pos) => {
                  if (node.isText && node.text) chunks.push({ pos, text: node.text });
                });

                try {
                  const matches = await getCodexMatches(chunks, flagged as any);
                  if (view.isDestroyed || myGeneration !== runGeneration) return;

                  const nameDecos: Decoration[] = [];
                  matches.forEach(m => {
                    const flag = flags.get(m.codexId);
                    if (!flag) return;
                    if (m.start < view.state.doc.content.size && m.end <= view.state.doc.content.size) {
                      nameDecos.push(
                        Decoration.inline(m.start, m.end, {
                          nodeName: 'span',
                          class: 'consistency-underline',
                          style: decoStyle(flag.severity),
                          title: flag.message,
                          'data-codex-id': String(m.codexId),
                        })
                      );
                    }
                  });

                  dispatchAll(nameDecos);
                } catch (err) {
                  console.error('Failed to compute consistency underlines', err);
                }
              }, 600);
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer);
            },
          };
        },
      }),
    ];
  },
});
