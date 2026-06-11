import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SemanticPhrase {
  text: string;
  confidence: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    semanticHighlight: {
      setSemanticPhrases: (phrases: SemanticPhrase[]) => ReturnType;
      clearSemanticPhrases: () => ReturnType;
    }
  }
}

const PLUGIN_KEY = new PluginKey('semanticHighlight');

export const SemanticHighlight = Extension.create({
  name: 'semanticHighlight',

  addStorage() {
    return {
      phrases: [] as SemanticPhrase[],
    };
  },

  addCommands() {
    return {
      setSemanticPhrases: (phrases: SemanticPhrase[]) => ({ tr, dispatch }) => {
        if (dispatch) {
          this.storage.phrases = phrases;
          tr.setMeta('semanticHighlightForceUpdate', true);
        }
        return true;
      },
      clearSemanticPhrases: () => ({ tr, dispatch }) => {
        if (dispatch) {
          this.storage.phrases = [];
          tr.setMeta('semanticHighlightForceUpdate', true);
        }
        return true;
      },
    }
  },

  addProseMirrorPlugins() {
    let debounceTimer: any = null;
    
    return [
      new Plugin({
        key: PLUGIN_KEY,
        state: {
          init: () => ({
            decorations: DecorationSet.empty,
            needsUpdate: false
          }),
          apply: (tr, value) => {
            const nextDecorations = tr.getMeta('semanticHighlightSetDecorations');
            if (nextDecorations) {
              return {
                decorations: nextDecorations,
                needsUpdate: false
              };
            }
            
            const forceUpdate = tr.getMeta('semanticHighlightForceUpdate');
            if (forceUpdate) {
              return {
                decorations: value.decorations.map(tr.mapping, tr.doc),
                needsUpdate: true
              };
            }
            
            if (tr.docChanged && value.decorations !== DecorationSet.empty) {
              return {
                decorations: value.decorations.map(tr.mapping, tr.doc),
                needsUpdate: true
              };
            }

            return value;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state).decorations;
          },
        },
        view: () => ({
          update: (view) => {
            const pluginState = PLUGIN_KEY.getState(view.state);
            if (!pluginState || !pluginState.needsUpdate) return;
            
            if (debounceTimer) clearTimeout(debounceTimer);
            
            debounceTimer = setTimeout(() => {
              const phrases = this.storage.phrases || [];
              if (phrases.length === 0) {
                if (!view.isDestroyed) {
                  view.dispatch(view.state.tr.setMeta('semanticHighlightSetDecorations', DecorationSet.empty));
                }
                return;
              }

              const doc = view.state.doc;
              const decorations: Decoration[] = [];
              
              const phraseStrings = phrases.map(p => p.text).sort((a,b) => b.length - a.length);
              if (phraseStrings.length > 0) {
                const escaped = phraseStrings.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                const regex = new RegExp(`(${escaped})`, 'gi');

                doc.descendants((node, pos) => {
                  if (node.isText && node.text) {
                    let match;
                    while ((match = regex.exec(node.text)) !== null) {
                      const matchText = match[0];
                      
                      const phraseObj = phrases.find(p => p.text.toLowerCase() === matchText.toLowerCase());
                      const confidence = phraseObj ? phraseObj.confidence : 0.5;
                      
                      const opacity = Math.max(0.1, Math.min(0.5, confidence));
                      const bgVal = `rgba(138, 43, 226, ${opacity})`;

                      // Check bounds
                      const start = pos + match.index;
                      const end = pos + match.index + match[0].length;
                      if (start < doc.content.size && end <= doc.content.size) {
                        decorations.push(
                          Decoration.inline(start, end, {
                            class: 'semantic-highlight-match',
                            style: `background-color: ${bgVal}; border-bottom: 2px dashed rgba(138,43,226,0.6);`,
                            title: `Kecocokan semantik tinggi (${(confidence * 100).toFixed(0)}%)`
                          })
                        );
                      }
                    }
                  }
                });
              }

              if (!view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta('semanticHighlightSetDecorations', DecorationSet.create(doc, decorations)));
              }
            }, 500); // 500ms debounce
          },
          destroy: () => {
            if (debounceTimer) clearTimeout(debounceTimer);
          }
        })
      }),
    ];
  },
});
