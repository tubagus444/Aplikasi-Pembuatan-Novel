import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/src/db';
import { CodexEntry, ChatMessage } from '@/src/types';
import { useOptimizedLiveQuery } from '@/src/hooks/useOptimizedLiveQuery';
import { useChatSession } from '@/src/hooks/useChatSession';
import { useAvailableProviders } from '@/src/hooks/useAvailableProviders';
import { useCodexCategories } from '@/src/features/codex/hooks/useCodexCategories';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useToast } from '@/src/hooks/useToast';
import { enrichEntities } from '@/src/services/ai';
import { invalidateContextCache } from '@/src/services/contextEngine';
import { WORKSHOP_DRAFT_INSTRUCTION, parseCodexDraft, stripCodexDraft } from '@/src/lib/codexDraft';

/** Satu field yang berubah antara entri asli dan draf, untuk konfirmasi diff sebelum menimpa. */
export interface FieldDiff {
  field: keyof CodexEntry;
  label: string;
  before: string;
  after: string;
}

const DIFF_FIELDS: (keyof CodexEntry)[] = ['name', 'category', 'description', 'aliases', 'tags'];
const FIELD_LABELS: Record<string, string> = {
  name: 'Nama',
  category: 'Kategori',
  description: 'Deskripsi',
  aliases: 'Alias',
  tags: 'Tag',
};

/** Normalisasi nilai field jadi string untuk perbandingan diff (array → daftar dipisah koma). */
function fmtField(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  return (v ?? '').toString();
}

/**
 * Otak Lokakarya Codex (Fase 1, mode buat-baru). Menyatukan:
 * - draf entitas (field terstruktur yang bisa diedit manual),
 * - sesi chat in-memory (useChatSession) yang terfokus ke entitas tsb,
 * - "Tarik dari diskusi": panen percakapan → field via enrichEntities,
 * - "Simpan ke Codex": tulis ke Dexie + invalidasi cache konteks AI.
 *
 * AI tidak pernah menulis ke DB sendiri; penulisan selalu lewat tombol Simpan.
 */
export function useCodexWorkshop(projectId: number) {
  const { workshopTarget, closeWorkshop, setViewMode } = useNavigation();
  const { toast } = useToast();

  const mode: 'create' | 'edit' = workshopTarget?.mode ?? 'create';
  const entryId = workshopTarget?.entryId;

  const entries = useOptimizedLiveQuery(
    () => db.codex.where('projectId').equals(projectId).toArray(),
    [projectId]
  );
  const bibleRules = useOptimizedLiveQuery(
    () => db.bible.where('projectId').equals(projectId).toArray(),
    [projectId]
  );
  const relationships = useOptimizedLiveQuery(
    () => db.relationships.where('projectId').equals(projectId).toArray(),
    [projectId]
  );
  const { categories } = useCodexCategories(projectId);

  const { availableProviders, selectedProvider, setSelectedProvider } = useAvailableProviders();

  // Draf entitas. Nama diawali dari seed (mis. dari deteksi chat) bila ada.
  const [draft, setDraft] = useState<Partial<CodexEntry>>(() => ({
    name: workshopTarget?.seedName ?? '',
    category: 'character',
    description: '',
    aliases: [],
    tags: [],
  }));

  // Baseline untuk mode edit: snapshot entri asli, dipakai menghitung diff.
  const [current, setCurrent] = useState<Partial<CodexEntry> | null>(null);
  const initRef = useRef(false);

  // Pada mode edit, muat entri yang dibahas ke draf + baseline (sekali, saat data siap).
  useEffect(() => {
    if (initRef.current || mode !== 'edit' || !entryId || !entries) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const base: Partial<CodexEntry> = {
      name: entry.name,
      category: entry.category,
      description: entry.description,
      aliases: [...(entry.aliases || [])],
      tags: [...(entry.tags || [])],
    };
    setDraft(base);
    setCurrent({ ...base });
    initRef.current = true;
  }, [mode, entryId, entries]);

  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pesan pembuka — dibuat sekali agar tidak ter-reset saat re-render.
  // Nama diambil dari seedName (mode edit MENGIRIM nama entri saat dibuka) agar
  // tidak bergantung pada live query `entries` yang mungkin belum siap di render awal.
  const welcomeMessage = useMemo<ChatMessage>(() => {
    const name = workshopTarget?.seedName?.trim();
    let content: string;
    if (mode === 'edit') {
      content = name
        ? `Mari tinjau & sempurnakan **${name}**. Datanya sudah saya muat di kanan. Tanyakan apakah ada yang janggal, minta saya perhalus deskripsi, atau bahas hubungannya dengan tokoh lain. Field di kanan ikut diperbarui otomatis sambil kita berdiskusi — saat siap, **Simpan perubahan**.`
        : `Mari tinjau & sempurnakan entri ini. Datanya sudah dimuat di kanan — tanyakan atau minta perbaikan apa saja.`;
    } else {
      content = name
        ? `Mari kita kembangkan **${name}** untuk Kamus Data. Ceritakan siapa dia, perannya, latar belakang, atau hubungan dengan tokoh lain. Field di kanan terisi otomatis sambil kita berdiskusi — sesuaikan bila perlu, lalu **Simpan ke Codex**.`
        : `Mari rancang entri Codex baru lewat diskusi. Mulailah dengan nama dan gambaran singkat entitasnya — karakter, lokasi, item, atau konsep. Field di kanan akan terisi otomatis seiring obrolan.`;
    }
    return { id: 'workshop-welcome', role: 'model', content, isWelcome: true, timestamp: Date.now() };
  }, [mode, workshopTarget?.seedName]);

  const chat = useChatSession({
    projectId,
    codexEntries: entries || [],
    bibleRules: bibleRules || [],
    relationships: relationships || [],
    provider: selectedProvider,
    extraSystem: WORKSHOP_DRAFT_INSTRUCTION,
    initialMessages: [welcomeMessage],
    onError: (msg) => reportAIError(msg),
  });

  // Live-fill: saat sebuah balasan AI selesai, panen blok codex-draft (bila ada)
  // dan terapkan ke draf. Diproses sekali per pesan (id ditandai), termasuk pesan
  // yang tak punya blok agar tak diperiksa ulang.
  const appliedRef = useRef<Set<string>>(new Set());
  const allowedCategorySlugs = useMemo(() => categories.map((c) => c.slug), [categories]);
  useEffect(() => {
    if (chat.isLoading) return;
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== 'model' || last.isWelcome || last.isError || !last.id) return;
    if (appliedRef.current.has(last.id)) return;
    appliedRef.current.add(last.id);
    const fields = parseCodexDraft(last.content, allowedCategorySlugs);
    // parseCodexDraft hanya menaruh key yang ada → spread aman, tak menimpa dgn undefined.
    if (fields) setDraft((prev) => ({ ...prev, ...fields }));
  }, [chat.isLoading, chat.messages, allowedCategorySlugs]);

  // Ringkasan draf sebagai konteks dinamis supaya AI tahu apa yang sedang dibangun.
  const draftContext = useCallback(() => {
    const parts: string[] = ['[Entitas Codex yang sedang dirancang di Lokakarya]'];
    if (draft.name) parts.push(`Nama: ${draft.name}`);
    if (draft.category) parts.push(`Kategori: ${draft.category}`);
    if (draft.aliases?.length) parts.push(`Alias: ${draft.aliases.join(', ')}`);
    if (draft.description) parts.push(`Deskripsi saat ini:\n${draft.description}`);
    return parts.join('\n');
  }, [draft]);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  function reportAIError(msg: string, code?: string) {
    if (code === 'INVALID_KEY' || code === 'QUOTA_EXCEEDED') {
      toast.error(msg, { action: { label: 'Buka Pengaturan', onClick: () => setViewMode('settings') } });
    } else {
      toast.error(msg);
    }
  }

  // onError sudah memunculkan toast; telan rejection agar tak jadi unhandled promise.
  const sendMessage = useCallback(
    (text: string) => { void chat.sendMessage(text, draftContext()).catch(() => {}); },
    [chat, draftContext]
  );
  const regenerate = useCallback(
    () => { void chat.regenerate(draftContext()).catch(() => {}); },
    [chat, draftContext]
  );

  // Panen seluruh diskusi (di luar pesan pembuka) menjadi field entri via enrichEntities.
  const harvestFromDiscussion = useCallback(async () => {
    const name = draftRef.current.name?.trim();
    if (!name) {
      toast.error('Isi Nama entri terlebih dahulu sebelum menarik dari diskusi.');
      return;
    }
    const transcript = chat.messages
      .filter((m) => !m.isWelcome && !m.isError && m.content.trim())
      // Buang blok codex-draft dari balasan AI agar JSON tak ikut diumpankan ke enrichEntities.
      .map((m) => `${m.role === 'user' ? 'Penulis' : 'AI'}: ${(m.role === 'model' ? stripCodexDraft(m.content) : m.content).trim()}`)
      .filter((line) => line.replace(/^(Penulis|AI):\s*/, '').length > 0)
      .join('\n\n');
    if (!transcript) {
      toast.error('Belum ada diskusi yang bisa ditarik. Mulai mengobrol dulu dengan AI.');
      return;
    }

    setIsHarvesting(true);
    try {
      const [enriched] = await enrichEntities([{ name, excerpts: transcript }], bibleRules || []);
      if (!enriched) {
        toast.error('AI tidak menghasilkan ringkasan entitas. Coba perjelas diskusinya.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        category: enriched.category || prev.category,
        description: enriched.description || prev.description,
        aliases: enriched.aliases?.length ? enriched.aliases : prev.aliases,
      }));
      toast.success('Field diisi dari diskusi. Periksa dan sunting sebelum menyimpan.');
    } catch (e: any) {
      reportAIError(e?.message || 'Gagal menarik dari diskusi.', e?.code);
    } finally {
      setIsHarvesting(false);
    }
  }, [chat.messages, bibleRules, toast]);

  const trimmedName = draft.name?.trim().toLowerCase() ?? '';
  const isDuplicateName =
    trimmedName.length > 0 &&
    (entries || []).some((e) => e.id !== entryId && e.name.trim().toLowerCase() === trimmedName);

  // Diff per-field draf vs baseline (hanya relevan di mode edit) untuk konfirmasi sebelum menimpa.
  const diff = useMemo<FieldDiff[]>(() => {
    if (mode !== 'edit' || !current) return [];
    return DIFF_FIELDS.flatMap((f) => {
      const before = fmtField(current[f]);
      const after = fmtField(draft[f]);
      return before === after ? [] : [{ field: f, label: FIELD_LABELS[f], before, after }];
    });
  }, [mode, current, draft]);

  const hasChanges = diff.length > 0;

  const canSave =
    !!draft.name?.trim() &&
    !!draft.description?.trim() &&
    !isSaving &&
    (mode === 'create' || hasChanges);

  const save = useCallback(async () => {
    const name = draft.name?.trim();
    const description = draft.description?.trim();
    if (!name || !description) return;
    setIsSaving(true);
    try {
      const payload = {
        name,
        category: draft.category || 'character',
        description,
        aliases: draft.aliases || [],
        tags: draft.tags || [],
      };
      if (mode === 'edit' && entryId) {
        await db.codex.update(entryId, payload);
      } else {
        await db.codex.add({ projectId, ...payload } as CodexEntry);
      }
      // Lore berubah → cache konteks AI harus disegarkan (selaras dengan jalur simpan Codex).
      await invalidateContextCache();
      toast.success(
        mode === 'edit' ? `Perubahan "${name}" disimpan.` : `"${name}" ditambahkan ke Kamus Data.`
      );
      closeWorkshop();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan entri.');
    } finally {
      setIsSaving(false);
    }
  }, [draft, mode, entryId, projectId, toast, closeWorkshop]);

  return {
    // data
    entries: entries || [],
    categories,
    mode,
    // draf
    draft,
    setDraft,
    isDuplicateName,
    diff,
    hasChanges,
    // chat
    messages: chat.messages,
    isLoading: chat.isLoading,
    retryStatus: chat.retryStatus,
    sendMessage,
    stop: chat.stop,
    regenerate,
    availableProviders,
    selectedProvider,
    setSelectedProvider,
    // aksi
    isHarvesting,
    harvestFromDiscussion,
    isSaving,
    canSave,
    save,
    close: closeWorkshop,
  };
}
