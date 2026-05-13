/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Extension, Range } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      replace: () => ReturnType;
      replaceAll: () => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      setRegex: (isRegex: boolean) => ReturnType;
    };
  }
}

interface SearchAndReplaceOptions {
  searchResultClass: string;
  searchResultCurrentClass: string;
  disableRegex: boolean;
  caseSensitive: boolean;
}

interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Range[];
  currentIndex: number;
  caseSensitive: boolean;
  isRegex: boolean;
}

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions, SearchAndReplaceStorage>({
  name: 'searchAndReplace',

  addOptions() {
    return {
      searchResultClass: 'search-result',
      searchResultCurrentClass: 'search-result-current',
      disableRegex: false,
      caseSensitive: false,
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [],
      currentIndex: -1,
      caseSensitive: this.options.caseSensitive,
      isRegex: !this.options.disableRegex,
    };
  },

  addCommands() {
    return {
      setSearchTerm: (searchTerm: string) => ({ editor, dispatch }) => {
        this.storage.searchTerm = searchTerm;
        return true;
      },
      setReplaceTerm: (replaceTerm: string) => ({ editor, dispatch }) => {
        this.storage.replaceTerm = replaceTerm;
        return true;
      },
      setCaseSensitive: (caseSensitive: boolean) => ({ editor, dispatch }) => {
        this.storage.caseSensitive = caseSensitive;
        return true;
      },
      setRegex: (isRegex: boolean) => ({ editor, dispatch }) => {
        this.storage.isRegex = isRegex;
        return true;
      },
      nextSearchResult: () => ({ editor, dispatch }) => {
        const { results, currentIndex } = this.storage;
        if (results.length === 0) return false;
        
        this.storage.currentIndex = (currentIndex + 1) % results.length;
        
        if (dispatch) {
            const currentMatch = results[this.storage.currentIndex];
            editor.commands.setTextSelection(currentMatch);
            editor.commands.scrollIntoView();
        }
        
        return true;
      },
      previousSearchResult: () => ({ editor, dispatch }) => {
        const { results, currentIndex } = this.storage;
        if (results.length === 0) return false;
        
        this.storage.currentIndex = currentIndex <= 0 ? results.length - 1 : currentIndex - 1;
        
        if (dispatch) {
            const currentMatch = results[this.storage.currentIndex];
            editor.commands.setTextSelection(currentMatch);
            editor.commands.scrollIntoView();
        }
        
        return true;
      },
      replace: () => ({ editor, state, dispatch }) => {
        const { results, currentIndex, replaceTerm } = this.storage;
        if (currentIndex < 0 || currentIndex >= results.length) return false;
        
        const { from, to } = results[currentIndex];
        
        if (dispatch) {
            editor.chain().insertContentAt({ from, to }, replaceTerm).focus().run();
        }
        
        return true;
      },
      replaceAll: () => ({ editor, state, dispatch }) => {
        const { results, replaceTerm } = this.storage;
        if (results.length === 0) return false;
        
        if (dispatch) {
            let offset = 0;
            const chain = editor.chain();
            results.forEach(result => {
                chain.insertContentAt({ from: result.from + offset, to: result.to + offset }, replaceTerm);
                offset += replaceTerm.length - (result.to - result.from);
            });
            chain.run();
        }
        
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    
    return [
      new Plugin({
        key: new PluginKey('searchAndReplace'),
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldState) {
            const { searchTerm, caseSensitive, isRegex } = extension.storage;
            
            if (!searchTerm) {
              extension.storage.results = [];
              extension.storage.currentIndex = -1;
              return DecorationSet.empty;
            }
            
            if (tr.docChanged || tr.getMeta('searchAndReplace')) {
                const results: Range[] = [];
                const decorations: Decoration[] = [];
                
                const flags = caseSensitive ? 'g' : 'gi';
                let regex: RegExp;
                
                try {
                    if (isRegex) {
                        regex = new RegExp(searchTerm, flags);
                    } else {
                        regex = new RegExp(searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), flags);
                    }
                } catch (e) {
                    return DecorationSet.empty;
                }
                
                tr.doc.descendants((node, pos) => {
                    if (node.isText && node.text) {
                        let match;
                        while ((match = regex.exec(node.text)) !== null) {
                            const from = pos + match.index;
                            const to = from + match[0].length;
                            results.push({ from, to });
                        }
                    }
                });
                
                extension.storage.results = results;
                
                results.forEach((range, index) => {
                    const isCurrent = index === extension.storage.currentIndex;
                    decorations.push(
                        Decoration.inline(range.from, range.to, {
                            class: isCurrent ? extension.options.searchResultCurrentClass : extension.options.searchResultClass,
                        })
                    );
                });
                
                return DecorationSet.create(tr.doc, decorations);
            }
            
            return oldState.map(tr.mapping, tr.doc);
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
