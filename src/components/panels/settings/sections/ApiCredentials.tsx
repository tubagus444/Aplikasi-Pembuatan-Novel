import React, { useState } from 'react';
import { Save, Check, Key, Loader2 } from 'lucide-react';
import { fetchGoogleModels } from '@/src/services/ai';
import { cn } from '@/src/lib/utils';
import { OpenRouterModelSelect } from '@/src/components/common/OpenRouterModelSelect';
import { ConnectionTestButton } from '@/src/components/panels/settings/ConnectionTestButton';
import { ConnectionTestError } from '@/src/components/panels/settings/ConnectionTestError';
import { useConnectionTest } from '@/src/components/panels/settings/useConnectionTest';
import type { ProviderKeys, ProviderModels } from '@/src/components/panels/settings/useAISettings';

interface Props {
  keys: ProviderKeys;
  setKeys: (v: ProviderKeys) => void;
  models: ProviderModels;
  setModels: (v: ProviderModels) => void;
  isSaved: boolean;
  onSave: () => void;
}

const PROVIDERS = [
  { id: 'google', name: 'Google AI Studio', placeholder: 'AIzaSy...' },
  { id: 'groq', name: 'Groq Cloud', placeholder: 'gsk_...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'claude', name: 'Claude (Anthropic)', placeholder: 'sk-ant-...' },
] as const;

export function ApiCredentials({ keys, setKeys, models, setModels, isSaved, onSave }: Props) {
  const { statusOf, errors, runTest } = useConnectionTest();

  const [googleModels, setGoogleModels] = useState<any[]>([]);
  const [isQueryingModels, setIsQueryingModels] = useState(false);
  const [queryModelsError, setQueryModelsError] = useState<string | null>(null);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);

  const handleTest = (prov: string) => {
    const key = keys[prov as keyof ProviderKeys]?.trim();
    if (!key) return;
    const model = models[prov as keyof ProviderModels]?.trim();
    runTest(prov, key, model);
  };

  const handleInspectGoogleModels = async () => {
    const key = keys.google?.trim();
    if (!key) {
      setQueryModelsError("Silakan masukkan Google API Key terlebih dahulu.");
      setShowModelsDropdown(true);
      return;
    }

    setIsQueryingModels(true);
    setQueryModelsError(null);
    setShowModelsDropdown(true);

    try {
      const data = await fetchGoogleModels(key);
      if (data.models && Array.isArray(data.models)) {
        // Filter generateContent models
        const list = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => {
            // strip 'models/' prefix
            const name = m.name.startsWith('models/') ? m.name.substring(7) : m.name;
            return {
              name,
              displayName: m.displayName || name,
              description: m.description || ''
            };
          });
        setGoogleModels(list);
      } else {
        setQueryModelsError(data.error || "Format data yang diterima dari Google API tidak sesuai.");
      }
    } catch (err: any) {
      console.error(err);
      setQueryModelsError(err.message || "Gagal mengambil daftar model.");
    } finally {
      setIsQueryingModels(false);
    }
  };

  const selectGoogleModel = (modelName: string) => {
    setModels({ ...models, google: modelName });
    setShowModelsDropdown(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-indigo-500" />
          <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Kredensial API</h3>
        </div>
        <button
          onClick={onSave}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95"
        >
          {isSaved ? <Check size={16} /> : <Save size={16} />}
          {isSaved ? 'Tersimpan!' : 'Simpan Kredensial'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800/60">
        {PROVIDERS.map((item) => (
          <div key={item.id} className="p-5 flex flex-col md:flex-row md:items-start gap-4">
            <div className="md:w-1/3">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {item.name}
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {item.id === 'google' ? 'Direkomendasikan demi performa Lore yang lebih baik.' : 'Pengaturan penyedia lain.'}
              </p>
            </div>

            <div className="md:w-2/3 flex flex-col gap-2">
              <div className="flex gap-2">
                 <input
                   type="password"
                   value={keys[item.id as keyof ProviderKeys]}
                   onChange={(e) => setKeys({...keys, [item.id]: e.target.value})}
                   placeholder={`Kunci: ${item.placeholder}`}
                   className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                 />
                 <ConnectionTestButton
                   status={statusOf(item.id)}
                   disabled={!keys[item.id as keyof ProviderKeys]}
                   onClick={() => handleTest(item.id)}
                 />
              </div>

              {item.id === 'openrouter' ? (
                <div className="w-full">
                   <OpenRouterModelSelect
                     value={models.openrouter}
                     onChange={(val) => setModels({...models, openrouter: val})}
                   />
                </div>
              ) : (
                <div className="w-full relative">
                  <input
                     type="text"
                     value={models[item.id as keyof ProviderModels]}
                     onChange={(e) => setModels({...models, [item.id]: e.target.value})}
                     placeholder={item.id === 'google' ? "Model (Cth: gemini-3.5-flash)" : "Nama model"}
                     className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  />
                  {item.id === 'google' && (
                     <div>
                        <button
                          type="button"
                          onClick={handleInspectGoogleModels}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1 mt-1.5 transition-all"
                        >
                          🔍 {isQueryingModels ? "Mengambil daftar model yang didukung..." : "Lihat model yang tersedia untuk key ini"}
                        </button>

                        {showModelsDropdown && (
                          <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 space-y-1">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5 mb-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Model Tersedia:</span>
                              <button
                                type="button"
                                onClick={() => setShowModelsDropdown(false)}
                                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
                              >
                                Tutup
                              </button>
                            </div>

                            {isQueryingModels ? (
                              <div className="text-[11px] text-slate-500 text-center py-4 flex items-center justify-center gap-2">
                                <Loader2 size={12} className="animate-spin" />
                                Memuat model...
                              </div>
                            ) : queryModelsError ? (
                              <div className="text-[11px] text-red-500 p-1">
                                ⚠️ {queryModelsError}
                              </div>
                            ) : googleModels.length === 0 ? (
                              <div className="text-[11px] text-slate-500 text-center py-2">
                                Tidak ada model ditemukan, atau Kunci API tidak valid.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-1">
                                {googleModels.map((m) => (
                                  <button
                                    key={m.name}
                                    type="button"
                                    onClick={() => selectGoogleModel(m.name)}
                                    className={cn(
                                      "w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors flex flex-col gap-0.5",
                                      models.google === m.name
                                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                    )}
                                  >
                                    <span className="font-semibold">{m.displayName}</span>
                                    <span className="text-[9px] text-slate-400 line-clamp-1">{m.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                     </div>
                  )}
                </div>
              )}

              <ConnectionTestError message={errors[item.id]} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
