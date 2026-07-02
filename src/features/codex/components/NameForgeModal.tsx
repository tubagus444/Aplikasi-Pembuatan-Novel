/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bengkel Nama (#3) — modal generator & glos nama patuh palet fonotaktik.
 * Palet tersimpan sebagai `CodexEntry.namePalette` (JSON inert). Logika murni di
 * `src/lib/nameForge.ts`; modal ini hanya UI edit-palet + generate + glos. Nol token.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Dices, Sparkles, Copy, Check, Save, ScanSearch } from 'lucide-react';
import { db } from '@/src/db';
import { useToast } from '@/src/hooks/useToast';
import { CodexEntry, NamePalette } from '@/src/types';
import {
  generatePhonetic, composeMorphemic, glossName, emptyPalette, PALETTE_PRESETS,
  type ComposedName, type GlossResult,
} from '@/src/lib/nameForge';
import { cn } from '@/src/lib/utils';

const inputCls = 'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 dark:text-slate-100';

// Onset/coda boleh berisi "" (opsional tanpa konsonan) → pertahankan entri kosong
// hanya bila ditulis eksplisit sebagai ",,". Untuk kesederhanaan v1: buang yang kosong.
const splitList = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

/** Morfem sebagai teks: satu baris "akar = makna" (atau ":"). */
function morphemesToText(p: NamePalette): string {
  return (p.morphemes ?? []).map((m) => `${m.root} = ${m.meaning}`).join('\n');
}
function parseMorphemes(text: string): NamePalette['morphemes'] {
  const out: { root: string; meaning: string }[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(.+?)\s*[=:]\s*(.*)$/);
    if (m) out.push({ root: m[1].trim(), meaning: m[2].trim() });
    else out.push({ root: t, meaning: '' });
  }
  return out.filter((m) => m.root);
}

export function NameForgeModal({ entry, onClose }: { entry: CodexEntry; onClose: () => void }) {
  const { toast } = useToast();
  const [palette, setPalette] = useState<NamePalette>(entry.namePalette ?? emptyPalette());
  const [morphText, setMorphText] = useState(() => morphemesToText(entry.namePalette ?? emptyPalette()));
  const [count, setCount] = useState(8);
  const [phonetic, setPhonetic] = useState<string[]>([]);
  const [compound, setCompound] = useState<ComposedName[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [glossInput, setGlossInput] = useState('');
  const [gloss, setGloss] = useState<GlossResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Palet efektif (dengan morfem hasil parse teks) untuk generate/glos & simpan.
  const effective: NamePalette = { ...palette, morphemes: parseMorphemes(morphText) };
  const hasMorphemes = (effective.morphemes ?? []).length > 0;

  const set = (patch: Partial<NamePalette>) => setPalette((p) => ({ ...p, ...patch }));

  const applyPreset = (id: string) => {
    const preset = PALETTE_PRESETS.find((x) => x.id === id);
    if (!preset) return;
    setPalette({ ...preset.palette });
    setMorphText(morphemesToText(preset.palette));
    setPhonetic([]); setCompound([]);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200);
    }).catch(() => {});
  };

  const doGloss = () => {
    if (!glossInput.trim()) { setGloss(null); return; }
    setGloss(glossName(glossInput.trim(), effective.morphemes ?? []));
  };

  const save = async () => {
    if (entry.id == null || saving) return;
    setSaving(true);
    try {
      await db.codex.update(entry.id, { namePalette: effective });
      toast.success('Palet nama disimpan pada entri.');
      onClose();
    } catch {
      toast.error('Gagal menyimpan palet.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"><Dices size={18} /></span>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Bengkel Nama</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Palet untuk: {entry.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kiri: editor palet */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {PALETTE_PRESETS.map((p) => (
                <button key={p.id} onClick={() => applyPreset(p.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>

            <Field label="Pola suku kata (C=konsonan, V=vokal)">
              <input value={palette.patterns.join(', ')} onChange={(e) => set({ patterns: splitList(e.target.value) })} placeholder="CV, CVC, V" className={inputCls} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Onset"><input value={palette.onsets.join(', ')} onChange={(e) => set({ onsets: splitList(e.target.value) })} placeholder="k, dr, str" className={inputCls} /></Field>
              <Field label="Nukleus"><input value={palette.nuclei.join(', ')} onChange={(e) => set({ nuclei: splitList(e.target.value) })} placeholder="a, ae, io" className={inputCls} /></Field>
              <Field label="Coda"><input value={palette.codas.join(', ')} onChange={(e) => set({ codas: splitList(e.target.value) })} placeholder="n, r, th" className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Suku kata min"><input type="number" min={1} max={6} value={palette.minSyllables ?? 2} onChange={(e) => set({ minSyllables: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Suku kata maks"><input type="number" min={1} max={6} value={palette.maxSyllables ?? 3} onChange={(e) => set({ maxSyllables: Number(e.target.value) })} className={inputCls} /></Field>
            </div>
            <Field label="Leksikon morfem (satu per baris: akar = makna)">
              <textarea value={morphText} onChange={(e) => setMorphText(e.target.value)} rows={4} placeholder={'kel = batu\nmar = laut\nthorn = bahaya'} className={cn(inputCls, 'resize-y font-mono text-[13px]')} />
            </Field>
          </div>

          {/* Kanan: hasil + glos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Jumlah</label>
              <input type="number" min={1} max={40} value={count} onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value))))} className="w-16 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm dark:text-slate-100" />
              <button onClick={() => { setPhonetic(generatePhonetic(effective, count)); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors active:scale-95">
                <Sparkles size={13} /> Fonetik
              </button>
              <button onClick={() => { setCompound(composeMorphemic(effective, count)); }} disabled={!hasMorphemes} title={hasMorphemes ? '' : 'Isi leksikon morfem dulu'} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-40 transition-colors active:scale-95">
                <Dices size={13} /> Majemuk
              </button>
            </div>

            {(phonetic.length > 0 || compound.length > 0) ? (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {phonetic.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {phonetic.map((n) => <NameChip key={n} label={n} copied={copied === n} onCopy={() => copy(n)} />)}
                  </div>
                )}
                {compound.map((c, i) => (
                  <button key={`${c.name}-${i}`} onClick={() => copy(c.name)} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-50/60 dark:bg-purple-900/15 border border-purple-100 dark:border-purple-800/40 hover:bg-purple-100/60 dark:hover:bg-purple-900/25 transition-colors">
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
                      <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">{c.parts.map((p) => p.meaning || p.root).join(' + ')}</span>
                    </span>
                    {copied === c.name ? <Check size={13} className="text-emerald-500 shrink-0" /> : <Copy size={13} className="text-slate-400 shrink-0" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4">Atur palet lalu klik "Fonetik" atau "Majemuk" untuk menghasilkan nama. Klik nama untuk menyalin.</p>
            )}

            {/* Glos / dekomposisi */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Uraikan nama (glos)</label>
              <div className="flex items-center gap-2">
                <input value={glossInput} onChange={(e) => setGlossInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doGloss(); }} placeholder="mis. Kelmar" className={inputCls} />
                <button onClick={doGloss} className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ScanSearch size={13} /> Urai</button>
              </div>
              {gloss && (
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {gloss.parts.length ? (
                    <span>{gloss.parts.map((p, i) => <span key={i}><span className="font-semibold">{p.root}</span>{p.meaning ? ` (${p.meaning})` : ''}{i < gloss.parts.length - 1 ? ' + ' : ''}</span>)}</span>
                  ) : <span className="text-slate-400">Tak ada akar dikenal.</span>}
                  {!gloss.covered && gloss.remainder && <span className="text-amber-500"> · sisa: "{gloss.remainder}"</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800/60">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Deterministik & nol token. Palet tersimpan pada entri ini.</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Tutup</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors active:scale-95">
              <Save size={14} /> Simpan Palet
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function NameChip({ label, copied, onCopy }: { label: string; copied: boolean; onCopy: () => void }) {
  return (
    <button onClick={onCopy} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
      {label}
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
