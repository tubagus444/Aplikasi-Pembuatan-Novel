import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { AhoCorasick } from '@/src/lib/ahoCorasick';

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
              let newDecorations = value.decorations.map(tr.mapping, tr.doc);
              const entries = options.getCodexEntries();
              const ac = getLocalAcInstance(entries);
              
              if (ac && entries.length > 0) {
                const changedRanges: {start: number, end: number}[] = [];
                tr.mapping.maps.forEach((stepMap, i) => {
                  stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
                    const start = tr.mapping.slice(i + 1).map(newStart, -1);
                    const end = tr.mapping.slice(i + 1).map(newEnd, 1);
                    changedRanges.push({ start, end });
                  });
                });

                const blocksToScan = new Map<number, ProseMirrorNode>();
                
                changedRanges.forEach(range => {
                  if (range.start < 0 || range.end > newState.doc.content.size) return;
                  
                  newState.doc.nodesBetween(
                    Math.max(0, range.start), 
                    Math.min(newState.doc.content.size, range.end), 
                    (node, pos) => {
                      if (node.isTextblock) {
                        blocksToScan.set(pos, node);
                        return false; 
                      }
                      return true;
                    }
                  );
                });

                blocksToScan.forEach((node, pos) => {
                  const pStart = pos;
                  const pEnd = pos + node.nodeSize;
                  
                  const decosToRemove = newDecorations.find(pStart, pEnd);
                  newDecorations = newDecorations.remove(decosToRemove);
                  
                  const newDecos: Decoration[] = [];
                  node.descendants((child, childPos) => {
                    if (child.isText) {
                      const text = child.text || '';
                      const matches = ac.search(text);
                      matches.forEach(match => {
                        newDecos.push(
                          Decoration.inline(pStart + 1 + childPos + match.start, pStart + 1 + childPos + match.end, {
                            nodeName: 'span',
                            class: 'codex-highlight group',
                            'data-codex-id': match.data.id?.toString(),
                          })
                        );
                      });
                    }
                  });
                  if (newDecos.length > 0) {
                    newDecorations = newDecorations.add(newState.doc, newDecos);
                  }
                });
              }
              
              return {
                decorations: newDecorations,
                needsUpdate: false
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
