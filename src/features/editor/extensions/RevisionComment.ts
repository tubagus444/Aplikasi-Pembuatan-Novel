/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mark "catatan revisi": membungkus teks terpilih dengan stabilo + menyimpan
 * catatan penulis langsung sebagai atribut mark (commentId/note/resolved). Karena
 * mark ikut terserialisasi ke HTML bab, catatan otomatis tersimpan & ter-backup
 * bersama naskah — tanpa tabel/penyimpanan terpisah dan tanpa risiko orphan
 * (hapus teksnya → catatan ikut hilang).
 */
import { Mark, mergeAttributes } from '@tiptap/core';

const NAME = 'revisionComment';

export interface RevisionCommentAttrs {
  commentId: string;
  note?: string;
  resolved?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    revisionComment: {
      /** Bungkus selection sebagai catatan baru. */
      setRevisionComment: (attrs: RevisionCommentAttrs) => ReturnType;
      /** Perbarui atribut catatan pada selection (mis. teks note / status resolved). */
      updateRevisionComment: (attrs: Partial<RevisionCommentAttrs>) => ReturnType;
      /** Lepas mark catatan dari selection. */
      unsetRevisionComment: () => ReturnType;
    };
  }
}

export const RevisionComment = Mark.create({
  name: NAME,

  // Jangan rentangkan mark ke teks yang baru diketik setelah/sebelum sorotan.
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => (attrs.commentId ? { 'data-comment-id': attrs.commentId } : {}),
      },
      note: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note') || '',
        renderHTML: (attrs) => (attrs.note ? { 'data-note': attrs.note } : {}),
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-resolved') === 'true',
        renderHTML: (attrs) => ({ 'data-resolved': attrs.resolved ? 'true' : 'false' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const resolved = mark.attrs.resolved;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: resolved ? 'revision-comment revision-comment-resolved' : 'revision-comment',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setRevisionComment:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(NAME, attrs),
      updateRevisionComment:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(NAME, attrs),
      unsetRevisionComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(NAME),
    };
  },
});
