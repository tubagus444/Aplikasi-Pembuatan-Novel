import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';

interface PassiveCodexHighlightOptions {
  getCodexEntries: () => { id?: number; name: string; aliases?: string[]; description?: string; category?: string }[];
  onCodexClick?: (entryId: number, event: MouseEvent) => void;
}

const regexCache = new Map<string, RegExp>();

function getRegex(name: string): RegExp {
  if (!regexCache.has(name)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const start = name[0] && /\w/.test(name[0]) ? '\\b' : '';
    const end = name[name.length - 1] && /\w/.test(name[name.length - 1]) ? '\\b' : '';
    regexCache.set(name, new RegExp(`(${start}${escaped}${end})`, 'gi'));
  }
  return new RegExp(regexCache.get(name)!.source, 'gi'); // return fresh instance to reset lastIndex
}

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
    return [
      new Plugin({
        key: new PluginKey('passiveCodexHighlight'),
        state: {
          init(_, { doc }) {
            return getDecorations(doc, options.getCodexEntries());
          },
          apply(tr, old, oldState, newState) {
            if (!tr.docChanged && !tr.getMeta('updateCodexHighlights')) return old;
            
            // Invalidasi cache saat codex diupdate dari luar
            if (tr.getMeta('updateCodexHighlights')) regexCache.clear();
            
            return getDecorations(newState.doc, options.getCodexEntries());
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
      }),
    ];
  },
});

function getDecorations(doc: ProseMirrorNode, entries: any[]): DecorationSet {
  const decorations: Decoration[] = [];
  
  if (!entries || entries.length === 0) {
    return DecorationSet.empty;
  }

  // Create an array of search strings (names + aliases)
  const searchItems = entries.flatMap(entry => {
    const names = [entry.name, ...(entry.aliases || [])].filter(Boolean);
    return names.map(name => ({ ...entry, matchName: name }));
  });

  // Sort by length descending to match longest phrases first
  searchItems.sort((a, b) => b.matchName.length - a.matchName.length);

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    
    const text = node.text || '';
    let match;
    
    const usedRanges: {from: number, to: number}[] = [];

    // Helper to check if a range is already highlighted
    const isOverlapping = (from: number, to: number) => {
      return usedRanges.some(r => Math.max(from, r.from) < Math.min(to, r.to));
    }

    searchItems.forEach(item => {
      const regex = getRegex(item.matchName);

      while ((match = regex.exec(text)) !== null) {
        const startPos = pos + match.index;
        const endPos = startPos + match[0].length;
        
        if (!isOverlapping(startPos, endPos)) {
          usedRanges.push({ from: startPos, to: endPos });
          
          decorations.push(
            Decoration.inline(startPos, endPos, {
              nodeName: 'span',
              class: 'codex-highlight group',
              'data-codex-id': item.id?.toString(),
            })
          );
        }
      }
    });
  });

  return DecorationSet.create(doc, decorations);
}
