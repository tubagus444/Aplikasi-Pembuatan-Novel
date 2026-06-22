import React from 'react';
import { HardDrive } from 'lucide-react';
import { OllamaModelSelect } from '@/src/components/common/OllamaModelSelect';
import { ConnectionTestButton } from '@/src/components/panels/settings/ConnectionTestButton';
import { ConnectionTestError } from '@/src/components/panels/settings/ConnectionTestError';
import { useConnectionTest } from '@/src/components/panels/settings/useConnectionTest';

interface Props {
  ollamaEnabled: boolean;
  setOllamaEnabled: (v: boolean) => void;
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
}

export function OllamaConfig({
  ollamaEnabled, setOllamaEnabled,
  ollamaBaseUrl, setOllamaBaseUrl,
  model, onModelChange,
}: Props) {
  const { statusOf, errors, runTest } = useConnectionTest();

  const handleTest = () => {
    localStorage.setItem('ollama_base_url', ollamaBaseUrl); // Make sure latest base URL is tested
    runTest('ollama', '', model?.trim() || '');
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <HardDrive size={18} className="text-indigo-500" />
        <div>
          <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Penyedia AI Lokal</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Jalankan model secara lokal, 100% offline tanpa API Key.</p>
        </div>
      </div>

      <div className="p-5 flex flex-col md:flex-row md:items-start gap-4 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl shadow-sm">
        <div className="md:w-1/3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            <input
              type="checkbox"
              checked={ollamaEnabled}
              onChange={(e) => setOllamaEnabled(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Ollama Aktif
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Membutuhkan aplikasi Ollama berjalan dengan properti CORS yang dikonfigurasi.
          </p>
        </div>

        <div className="md:w-2/3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder="Base URL: http://localhost:11434"
              disabled={!ollamaEnabled}
              className="flex-1 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow disabled:opacity-50"
            />
            <ConnectionTestButton
              status={statusOf('ollama')}
              disabled={!ollamaEnabled}
              onClick={handleTest}
            />
          </div>

          <div className="w-full" style={{ opacity: ollamaEnabled ? 1 : 0.5, pointerEvents: ollamaEnabled ? 'auto' : 'none' }}>
             <OllamaModelSelect
               value={model}
               onChange={onModelChange}
               baseUrl={ollamaBaseUrl}
             />
          </div>

          <ConnectionTestError message={errors['ollama']} />
        </div>
      </div>
    </section>
  );
}
