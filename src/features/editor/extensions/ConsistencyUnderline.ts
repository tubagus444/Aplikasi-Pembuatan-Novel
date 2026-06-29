import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { getCodexMatches } from '@/src/services/contextEngine';
import { InlineConsistencyFlag } from '@/src/lib/inlineConsistency';

/**
 * Konsistensi inline — plumbing garis bawah di editor (Fase 1).
 *
 * Menggambar garis bawah bergelombang pada nama karakter yang ditandai oleh
 * lapisan deterministik (`getFlags`), dengan tooltip pesan + klik untuk membuka
 * Codex. Posisi nama diperoleh lewat worker Aho-Corasick (`getCodexMatches`) yang
 * sama dengan PassiveCodexHighlight, jadi pencocokan & boundary konsisten.
 *
 * Lapisan AI opsional (Fase 2) cukup menambah entri ke peta `getFlags` — tak
 * perlu menyentuh extension ini.
 */

interface ConsistencyUnderlineOptions {
  getEntries: () => { id?: number; name: string; aliases?: string[] }[];
  getFlags: () => Map<number, InlineConsistencyFlag>;
  onOpenCodex?: (entryId: number, event: MouseEvent) => void;
}

const PLUGIN_KEY = new PluginKey('consistencyUnderline');

const SEVERITY_COLOR: Record<InlineConsistencyFlag['severity'], string> = {
  high: '#ef4444',   // merah
  medium: '#f59e0b', // amber
  low: '#0ea5e9',    // biru langit
};

function decoStyle(severity: InlineConsistencyFlag['severity']): string {
  return [
    'text-decoration: underline',
    'text-decoration-style: wavy',
    `text-decoration-color: ${SEVERITY_COLOR[severity]}`,
    'text-decoration-skip-ink: none',
    'text-underline-offset: 3px',
    'cursor: help',
  ].join('; ');
}

export const ConsistencyUnderline = Extension.create<ConsistencyUnderlineOptions>({
  name: 'consistencyUnderline',

  addOptions() {
    return {
      getEntries: () => [],
      getFlags: () => new Map(),
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
                const entries = options.getEntries();
                const flagged = entries.filter(e => e.id != null && flags.has(e.id!));

                if (flagged.length === 0) {
                  if (!view.isDestroyed) {
                    view.dispatch(view.state.tr.setMeta('updateConsistencyDecos', DecorationSet.empty));
                  }
                  return;
                }

                const chunks: { pos: number; text: string }[] = [];
                view.state.doc.descendants((node, pos) => {
                  if (node.isText && node.text) chunks.push({ pos, text: node.text });
                });

                try {
                  const matches = await getCodexMatches(chunks, flagged as any);
                  if (view.isDestroyed || myGeneration !== runGeneration) return;

                  const decorations: Decoration[] = [];
                  matches.forEach(m => {
                    const flag = flags.get(m.codexId);
                    if (!flag) return;
                    if (m.start < view.state.doc.content.size && m.end <= view.state.doc.content.size) {
                      decorations.push(
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

                  view.dispatch(view.state.tr.setMeta('updateConsistencyDecos', DecorationSet.create(view.state.doc, decorations)));
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
