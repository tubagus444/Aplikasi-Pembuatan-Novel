import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { getCodexMatches } from '@/src/services/contextEngine';

interface PassiveCodexHighlightOptions {
  getCodexEntries: () => { id?: number; name: string; aliases?: string[]; description?: string; category?: string }[];
  onCodexClick?: (entryId: number, event: MouseEvent) => void;
}

const PLUGIN_KEY = new PluginKey('passiveCodexHighlight');

export const PassiveCodexHighlight = Extension.create<PassiveCodexHighlightOptions>({
  name: 'passiveCodexHighlight',

  addOptions() {
    return {
      getCodexEntries: () => [],
      onCodexClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    let debounceTimer: any = null;

    return [
      new Plugin({
        key: PLUGIN_KEY,
        state: {
          init(_, { doc }) {
            return {
              decorations: DecorationSet.empty,
              needsUpdate: true
            };
          },
          apply(tr, value, oldState, newState) {
            const nextDecorations = tr.getMeta('updateCodexHighlights');
            if (nextDecorations) {
              return {
                decorations: nextDecorations,
                needsUpdate: false
              };
            }
            
            const forceUpdate = tr.getMeta('forceUpdateCodex');
            if (forceUpdate) {
              return {
                decorations: value.decorations.map(tr.mapping, tr.doc),
                needsUpdate: true
              };
            }
            
            if (tr.docChanged) {
              const newDecorations = value.decorations.map(tr.mapping, tr.doc);
              return {
                decorations: newDecorations,
                needsUpdate: true // Jadwalkan update melalui debounce 500ms
              };
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
              if (target && target.classList.contains('codex-highlight')) {
                const codexId = target.getAttribute('data-codex-id');
                if (codexId && options.onCodexClick) {
                  options.onCodexClick(Number(codexId), event);
                  return true;
                }
              }
              if (target && target.classList.contains('mention')) {
                const mentionId = target.getAttribute('data-id');
                if (mentionId) {
                  const entries = options.getCodexEntries();
                  const foundEntry = entries.find(e => e.name.toLowerCase() === mentionId.toLowerCase());
                  if (foundEntry && foundEntry.id && options.onCodexClick) {
                    options.onCodexClick(Number(foundEntry.id), event);
                    return true;
                  }
                }
              }
              return false;
            }
          }
        },
        view(view) {
          return {
            update(view, prevState) {
              const pluginState = PLUGIN_KEY.getState(view.state);
              if (!pluginState || !pluginState.needsUpdate) {
                return;
              }

              if (debounceTimer) clearTimeout(debounceTimer);
              
              debounceTimer = setTimeout(async () => {
                const entries = options.getCodexEntries();
                if (!entries || entries.length === 0) {
                  if (!view.isDestroyed) {
                    view.dispatch(view.state.tr.setMeta('updateCodexHighlights', DecorationSet.empty));
                  }
                  return;
                }

                const chunks: { pos: number; text: string }[] = [];
                view.state.doc.descendants((node, pos) => {
                  if (node.isText && node.text) {
                    chunks.push({ pos, text: node.text });
                  }
                });

                try {
                  const matches = await getCodexMatches(chunks, entries as any);
                  
                  if (view.isDestroyed) return;
                  
                  const decorations: Decoration[] = [];
                  matches.forEach(m => {
                    // Check if bounds are valid for the current document
                    if (m.start < view.state.doc.content.size && m.end <= view.state.doc.content.size) {
                      decorations.push(
                        Decoration.inline(m.start, m.end, {
                          nodeName: 'span',
                          class: 'codex-highlight group',
                          'data-codex-id': m.codexId?.toString(),
                        })
                      );
                    }
                  });

                  const decorationSet = DecorationSet.create(view.state.doc, decorations);
                  view.dispatch(view.state.tr.setMeta('updateCodexHighlights', decorationSet));
                } catch (err) {
                  console.error("Failed to get codex matches", err);
                }
              }, 500); // Use 500ms debounce as discussed
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer);
            }
          };
        }
      }),
    ];
  },
});
