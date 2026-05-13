import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { AhoCorasick } from '../lib/ahoCorasick';

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
    let acInstance: AhoCorasick | null = null;
    let lastEntriesHash = '';

    function getLocalAcInstance(entries: any[]): AhoCorasick | null {
      if (!entries || entries.length === 0) return null;
      
      const currentHash = JSON.stringify(entries.map(e => ({ n: e.name, a: e.aliases })));
      if (currentHash !== lastEntriesHash || !acInstance) {
        const keywords = entries.flatMap(entry => {
          const names = [entry.name, ...(entry.aliases || [])].filter(Boolean);
          return names.map(name => ({ word: name, data: entry }));
        });
        acInstance = new AhoCorasick(keywords);
        lastEntriesHash = currentHash;
      }
      return acInstance;
    }

    return [
      new Plugin({
        key: PLUGIN_KEY,
        state: {
          init(_, { doc }) {
            return DecorationSet.empty;
          },
          apply(tr, old, oldState, newState) {
            const nextDecorations = tr.getMeta('updateCodexHighlights');
            if (nextDecorations) {
              return nextDecorations;
            }
            if (tr.docChanged) {
              return old.map(tr.mapping, tr.doc);
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
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
              return false;
            }
          }
        },
        view(view) {
          return {
            update(view, prevState) {
              if (view.state.doc.eq(prevState.doc) && !view.state.tr.getMeta('forceUpdateCodex')) {
                return;
              }

              if (debounceTimer) clearTimeout(debounceTimer);
              
              debounceTimer = setTimeout(() => {
                const entries = options.getCodexEntries();
                const ac = getLocalAcInstance(entries);
                if (!ac) {
                  if (!view.isDestroyed) {
                    view.dispatch(view.state.tr.setMeta('updateCodexHighlights', DecorationSet.empty));
                  }
                  return;
                }

                const decorations = getDecorationsInternal(view.state.doc, ac);
                
                // Only update if the view hasn't been destroyed
                if (!view.isDestroyed) {
                  view.dispatch(view.state.tr.setMeta('updateCodexHighlights', decorations));
                }
              }, 500);
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

function getDecorationsInternal(doc: ProseMirrorNode, ac: AhoCorasick): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    
    const text = node.text || '';
    const matches = ac.search(text);

    matches.forEach(match => {
      const startPos = pos + match.start;
      const endPos = pos + match.end;
      
      decorations.push(
        Decoration.inline(startPos, endPos, {
          nodeName: 'span',
          class: 'codex-highlight group',
          'data-codex-id': match.data.id?.toString(),
        })
      );
    });
  });

  return DecorationSet.create(doc, decorations);
}
