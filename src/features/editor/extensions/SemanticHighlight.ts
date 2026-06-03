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
          tr.setMeta('semanticHighlightUpdate', true);
        }
        return true;
      },
      clearSemanticPhrases: () => ({ tr, dispatch }) => {
        if (dispatch) {
          this.storage.phrases = [];
          tr.setMeta('semanticHighlightUpdate', true);
        }
        return true;
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('semanticHighlight'),
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, oldState) => {
            const isUpdate = tr.getMeta('semanticHighlightUpdate');
            const phrases = this.storage.phrases || [];
            
            if (!tr.docChanged && !isUpdate) {
              // Map old decorations to new ones if only selection changed
              return oldState.map(tr.mapping, tr.doc);
            }
            
            if (phrases.length === 0) {
              return DecorationSet.empty;
            }

            const doc = tr.doc;
            const decorations: Decoration[] = [];
            
            const phraseStrings = phrases.map(p => p.text).sort((a,b) => b.length - a.length);
            if (phraseStrings.length === 0) return DecorationSet.empty;

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

                  decorations.push(
                    Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
                      class: 'semantic-highlight-match',
                      style: `background-color: ${bgVal}; border-bottom: 2px dashed rgba(138,43,226,0.6);`,
                      title: `Kecocokan semantik tinggi (${(confidence * 100).toFixed(0)}%)`
                    })
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
