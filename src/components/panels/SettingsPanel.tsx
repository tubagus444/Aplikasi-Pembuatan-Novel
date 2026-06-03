import React, { useState, useEffect, useRef } from 'react';
import { Save, Check, Database, Upload, Download, AlertTriangle, RefreshCcw, XCircle, Loader2, FolderOpen, History, BrainCircuit, Key, HardDrive, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/src/db';
import { testConnection, fetchGoogleModels } from '@/src/services/ai';
import { cn } from '@/src/lib/utils';
import { useAutoBackup } from '@/src/hooks/useAutoBackup';
import { backupService } from '@/src/services/backupService';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { useStorageQuota } from '@/src/hooks/useStorageQuota';
import { ContextDepth } from '@/src/types';
import { OpenRouterModelSelect } from '@/src/components/common/OpenRouterModelSelect';
import { OllamaModelSelect } from '@/src/components/common/OllamaModelSelect';

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'ai' | 'backup'>('ai');

  const tabs = [
    { id: 'ai', label: 'Konfigurasi AI', icon: BrainCircuit },
    { id: 'backup', label: 'Data & Cadangan', icon: HardDrive },
  ];

  const { checkStorageQuota } = useStorageQuota();
  const { 
    lastBackupTime, 
    isBackingUp: isAutoBackingUp, 
    selectFolder, 
    triggerManualBackup, 
    folderName,
    isFileSystemSupported
  } = useAutoBackup();
  
  const [backupInterval, setBackupInterval] = useState(() => 
    localStorage.getItem('backup_interval') || '30'
  );

  const internalBackups = useLiveQuery(() => 
    backupService.getBackupList(),
    []
  );

  const handleIntervalChange = (val: string) => {
    setBackupInterval(val);
    localStorage.setItem('backup_interval', val);
    // Storage event will trigger in App context if multi-tab, 
    // or the Provider effect will pick it up if in same tab context
  };

  const handleInternalRestore = async (backupId: number, timestamp: number) => {
    const confirmRestore = window.confirm(
      `PERINGATAN: Ini akan menimpa SEMUA data Anda saat ini dengan cadangan dari ${format(timestamp, 'PPP p')}. Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin ingin melanjutkan?`
    );

    if (!confirmRestore) return;

    try {
      await backupService.restoreFromBackup(backupId);
      alert("Pemulihan berhasil! Halaman akan dimuat ulang.");
      window.location.reload();
    } catch (err) {
      console.error("Internal restore failed:", err);
      alert("Gagal memulihkan dari cadangan internal.");
    }
  };

  const [provider, setProvider] = useState('google');
  const [contextDepth, setContextDepth] = useState<ContextDepth>('balanced');
  // ... rest of the component state
  const [keys, setKeys] = useState({
    google: '',
    groq: '',
    openrouter: '',
    claude: ''
  });
  const [models, setModels] = useState({
    google: '',
    groq: '',
    openrouter: '',
    claude: '',
    ollama: ''
  });
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [ollamaEnabled, setOllamaEnabled] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [testStatuses, setTestStatuses] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({
    google: 'idle',
    groq: 'idle',
    openrouter: 'idle',
    claude: 'idle',
    ollama: 'idle'
  });
  const [testErrors, setTestErrors] = useState<Record<string, string>>({
    google: '',
    groq: '',
    openrouter: '',
    claude: '',
    ollama: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [googleModels, setGoogleModels] = useState<any[]>([]);
  const [isQueryingModels, setIsQueryingModels] = useState(false);
  const [queryModelsError, setQueryModelsError] = useState<string | null>(null);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);

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
    setModels(prev => ({ ...prev, google: modelName }));
    setShowModelsDropdown(false);
  };

  useEffect(() => {
    // Load from localStorage on mount with minimal obfuscation
    const loadKey = (name: string) => {
      try {
        const stored = localStorage.getItem(`ai_key_${name}`);
        return stored ? atob(stored) : '';
      } catch (e) {
        return '';
      }
    };

    const loadModel = (name: string) => {
      return localStorage.getItem(`ai_model_${name}`) || '';
    };

    setProvider(localStorage.getItem('ai_provider') || 'google');
    setContextDepth((localStorage.getItem('ai_context_depth') as ContextDepth) || 'balanced');
    setKeys({
      google: loadKey('google'),
      groq: loadKey('groq'),
      openrouter: loadKey('openrouter'),
      claude: loadKey('claude')
    });
    setModels({
      google: loadModel('google'),
      groq: loadModel('groq'),
      openrouter: loadModel('openrouter'),
      claude: loadModel('claude'),
      ollama: loadModel('ollama')
    });
    setOllamaBaseUrl(localStorage.getItem('ollama_base_url') || 'http://localhost:11434');
    setOllamaEnabled(localStorage.getItem('ollama_enabled') === 'true');
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_context_depth', contextDepth);
    localStorage.setItem('ollama_base_url', ollamaBaseUrl);
    localStorage.setItem('ollama_enabled', ollamaEnabled.toString());
    
    const saveKey = (name: string, value: string) => {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        localStorage.setItem(`ai_key_${name}`, btoa(trimmedValue));
        sessionStorage.setItem(`ai_key_${name}`, trimmedValue); // Active session usage
      } else {
        localStorage.removeItem(`ai_key_${name}`);
        sessionStorage.removeItem(`ai_key_${name}`);
      }
    };

    const saveModel = (name: string, value: string) => {
      if (value) {
        localStorage.setItem(`ai_model_${name}`, value);
      } else {
        localStorage.removeItem(`ai_model_${name}`);
      }
    };

    saveKey('google', keys.google);
    saveKey('groq', keys.groq);
    saveKey('openrouter', keys.openrouter);
    saveKey('claude', keys.claude);

    saveModel('google', models.google);
    saveModel('groq', models.groq);
    saveModel('openrouter', models.openrouter);
    saveModel('claude', models.claude);
    saveModel('ollama', models.ollama);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    // Dispatch storage event so hooks can pick up ollama changes in same window
    window.dispatchEvent(new Event('storage'));
  };

  const handleTestStatus = async (prov: string) => {
    let key = '';
    if (prov !== 'ollama') {
       key = keys[prov as keyof typeof keys]?.trim();
       if (!key) return;
    }

    const model = models[prov as keyof typeof models]?.trim();

    setTestStatuses(prev => ({ ...prev, [prov]: 'loading' }));
    setTestErrors(prev => ({ ...prev, [prov]: '' }));
    try {
      if (prov === 'ollama') {
         localStorage.setItem('ollama_base_url', ollamaBaseUrl); // Make sure latest base URL is tested
      }
      const ok = await testConnection(prov, key, model);
      setTestStatuses(prev => ({ ...prev, [prov]: ok ? 'success' : 'error' }));
      if (!ok) {
        setTestErrors(prev => ({ ...prev, [prov]: 'Koneksi gagal tanpa pesan error spesifik.' }));
      }
    } catch (error: any) {
      setTestStatuses(prev => ({ ...prev, [prov]: 'error' }));
      console.error(error);
      const msg = error.rawMessage || error.message || String(error);
      setTestErrors(prev => ({ ...prev, [prov]: msg }));
    } finally {
      setTimeout(() => {
        setTestStatuses(prev => ({ ...prev, [prov]: 'idle' }));
      }, 6000); // 6 seconds to let user read the fail/success state
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = {
        version: 1,
        timestamp: Date.now(),
        data: {
          projects: await db.projects.toArray(),
          chapters: await db.chapters.toArray(),
          codex: await db.codex.toArray(),
          bible: await db.bible.toArray(),
          aiActions: await db.aiActions.toArray(),
          snapshots: await db.snapshots.toArray(),
          timeline: await db.timeline.toArray(),
          relationships: await db.relationships.toArray()
        }
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aetherscribe-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to create backup:', error);
      alert('Gagal membuat cadangan. Lihat konsol untuk detailnya.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsRestoring(true);
        const content = event.target?.result as string;
        const backup = JSON.parse(content);

        if (!backup.data || !backup.data.projects) {
          throw new Error("Format file cadangan tidak valid");
        }

        const confirmRestore = window.confirm(
          "PERINGATAN: Ini akan menimpa SEMUA proyek, bab, entri kamus data, dan pengaturan Anda dengan data dari file cadangan. Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin ingin melanjutkan?"
        );

        if (!confirmRestore) {
          setIsRestoring(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        await db.transaction('rw', 
          [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships], 
          async () => {
            // Clear existing data
            await db.projects.clear();
            await db.chapters.clear();
            await db.codex.clear();
            await db.bible.clear();
            await db.aiActions.clear();
            await db.snapshots.clear();
            await db.timeline.clear();
            await db.relationships.clear();

            // Restore from backup
            if (backup.data.projects?.length) await db.projects.bulkAdd(backup.data.projects);
            if (backup.data.chapters?.length) await db.chapters.bulkAdd(backup.data.chapters);
            if (backup.data.codex?.length) await db.codex.bulkAdd(backup.data.codex);
            
            // Deduplicate bible entries before bulk adding to respect unique index
            if (backup.data.bible?.length) {
              const seen = new Set<string>();
              const uniqueBible = backup.data.bible.filter((entry: any) => {
                const compositeKey = `${entry.projectId}|${entry.key}`;
                if (seen.has(compositeKey)) return false;
                seen.add(compositeKey);
                return true;
              });
              await db.bible.bulkAdd(uniqueBible);
            }

            if (backup.data.aiActions?.length) await db.aiActions.bulkAdd(backup.data.aiActions);
            if (backup.data.snapshots?.length) await db.snapshots.bulkAdd(backup.data.snapshots);
            if (backup.data.timeline?.length) await db.timeline.bulkAdd(backup.data.timeline);
            if (backup.data.relationships?.length) await db.relationships.bulkAdd(backup.data.relationships);
        });

        alert("Pemulihan berhasil! Halaman akan dimuat ulang.");
        window.location.reload();
      } catch (error) {
        console.error('Failed to restore backup:', error);
        alert('Gagal memulihkan dari file cadangan. Pastikan ini adalah file JSON cadangan yang valid.');
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Pengaturan</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Kelola model AI, kredensial, dan data lokal Anda dengan mulus.
        </p>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 w-full custom-scrollbar overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'ai' | 'backup')}
            className={cn(
              "relative px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabIndicatorSettings"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'ai' ? (
          <motion.div
            key="ai-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Preferences */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-indigo-500" />
                  <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Preferensi</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Penyedia AI Default
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Pilih AI mana yang berjalan secara default.
                  </p>
                  <select 
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  >
                    <option value="google">Google AI Studio (Gemini)</option>
                    <option value="groq">Groq Cloud</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="claude">Anthropic (Claude)</option>
                    <option value="ollama">Ollama (Lokal)</option>
                  </select>
                </div>

                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Kedalaman Konteks
                    </label>
                    <span className={cn(
                      "text-[9px] font-bold uppercase py-0.5 px-2 rounded-full",
                      contextDepth === 'minimal' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                      contextDepth === 'balanced' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
                      contextDepth === 'deep' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {contextDepth === 'minimal' ? 'Eco Mode' : contextDepth === 'balanced' ? 'Optimal' : 'Power Mode'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex-1">
                    {contextDepth === 'minimal' && "Token rendah. Menjaga aturan, mengabaikan dunia."}
                    {contextDepth === 'balanced' && "Pencocokan cerdas. Otomatis memilih dunia."}
                    {contextDepth === 'deep' && "Token besar. Menggunakan kedetailan maksimum."}
                  </p>
                  <select 
                    value={contextDepth}
                    onChange={(e) => setContextDepth(e.target.value as ContextDepth)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  >
                    <option value="minimal">Minimal (Termurah)</option>
                    <option value="balanced">Seimbang (Direkomendasikan)</option>
                    <option value="deep">Mendalam (Detail Terkaya)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* API Credentials */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-indigo-500" />
                  <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Kredensial API</h3>
                </div>
                <button 
                  onClick={handleSave}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95"
                >
                  {isSaved ? <Check size={16} /> : <Save size={16} />}
                  {isSaved ? 'Tersimpan!' : 'Simpan Kredensial'}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800/60">
                {[
                  { id: 'google', name: 'Google AI Studio', placeholder: 'AIzaSy...' },
                  { id: 'groq', name: 'Groq Cloud', placeholder: 'gsk_...' },
                  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
                  { id: 'claude', name: 'Claude (Anthropic)', placeholder: 'sk-ant-...' },
                ].map((item) => (
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
                           value={keys[item.id as keyof typeof keys]}
                           onChange={(e) => setKeys({...keys, [item.id]: e.target.value})}
                           placeholder={`Kunci: ${item.placeholder}`}
                           className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                         />
                         <button
                           type="button"
                           onClick={() => handleTestStatus(item.id)}
                           disabled={!keys[item.id as keyof typeof keys] || testStatuses[item.id] === 'loading'}
                           title="Cek Koneksi"
                           className={cn(
                             "px-3 py-2 rounded-lg border transition-all flex items-center justify-center min-w-[85px]",
                             testStatuses[item.id] === 'idle' && "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700",
                             testStatuses[item.id] === 'loading' && "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700",
                             testStatuses[item.id] === 'success' && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-900/50",
                             testStatuses[item.id] === 'error' && "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-900/50"
                           )}
                         >
                           {testStatuses[item.id] === 'loading' && <Loader2 size={16} className="animate-spin" />}
                           {testStatuses[item.id] === 'success' && <Check size={16} />}
                           {testStatuses[item.id] === 'error' && <XCircle size={16} />}
                           {testStatuses[item.id] === 'idle' && <RefreshCcw size={14} className="mr-1.5" />}
                           <span className="text-xs font-medium">
                             {testStatuses[item.id] === 'idle' && 'Cek'}
                             {testStatuses[item.id] === 'loading' && '...'}
                             {testStatuses[item.id] === 'success' && 'Valid'}
                             {testStatuses[item.id] === 'error' && 'Gagal'}
                           </span>
                         </button>
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
                             value={models[item.id as keyof typeof models]}
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

                      <AnimatePresence>
                        {testErrors[item.id] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1 text-[11px] text-red-500 flex items-start gap-1.5 p-2.5 bg-red-50/50 dark:bg-red-950/15 rounded-lg border border-red-200/50 dark:border-red-900/30 font-mono select-text break-words">
                              <AlertTriangle size={14} className="shrink-0 text-red-500 mt-0.5" />
                              <span>{testErrors[item.id]}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* OLLAMA CONFIGURATION */}
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
                    <button
                      type="button"
                      onClick={() => handleTestStatus('ollama')}
                      disabled={!ollamaEnabled || testStatuses['ollama'] === 'loading'}
                      title="Cek Koneksi"
                      className={cn(
                        "px-3 py-2 rounded-lg border transition-all flex items-center justify-center min-w-[85px]",
                        testStatuses['ollama'] === 'idle' && "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700",
                        testStatuses['ollama'] === 'loading' && "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700",
                        testStatuses['ollama'] === 'success' && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-900/50",
                        testStatuses['ollama'] === 'error' && "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-900/50"
                      )}
                    >
                      {testStatuses['ollama'] === 'loading' && <Loader2 size={16} className="animate-spin" />}
                      {testStatuses['ollama'] === 'success' && <Check size={16} />}
                      {testStatuses['ollama'] === 'error' && <XCircle size={16} />}
                      {testStatuses['ollama'] === 'idle' && <RefreshCcw size={14} className="mr-1.5" />}
                      <span className="text-xs font-medium">
                        {testStatuses['ollama'] === 'idle' && 'Cek'}
                        {testStatuses['ollama'] === 'loading' && '...'}
                        {testStatuses['ollama'] === 'success' && 'Valid'}
                        {testStatuses['ollama'] === 'error' && 'Gagal'}
                      </span>
                    </button>
                  </div>

                  <div className="w-full" style={{ opacity: ollamaEnabled ? 1 : 0.5, pointerEvents: ollamaEnabled ? 'auto' : 'none' }}>
                     <OllamaModelSelect 
                       value={models.ollama}
                       onChange={(val) => setModels({...models, ollama: val})}
                       baseUrl={ollamaBaseUrl}
                     />
                  </div>

                  <AnimatePresence>
                    {testErrors['ollama'] && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 text-[11px] text-red-500 flex items-start gap-1.5 p-2.5 bg-red-50/50 dark:bg-red-950/15 rounded-lg border border-red-200/50 dark:border-red-900/30 font-mono select-text break-words">
                          <AlertTriangle size={14} className="shrink-0 text-red-500 mt-0.5" />
                          <span>{testErrors['ollama']}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="backup-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Semantic Cache Management */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} className="text-indigo-500" />
                <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Cache Semantik & Vektor</h3>
              </div>
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    Indeks vektor untuk pencarian semantik (Global Search) dan <strong>Auto-Summarizer</strong> yang berjalan di latar belakang akan diperbarui secara inkremental. Jika ada state semantik yang tidak konsisten atau hilang, Anda dapat membersihkan cachenya untuk memaksa pemrosesan ulang secara penuh.
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    if (window.confirm('Apakah Anda yakin ingin menghapus seluruh cache penyematan vektor semantik? Background worker akan membangun ulangnya secara asinkron.')) {
                      window.localStorage.removeItem('semantic_vector_cache_v1');
                      alert('Cache penyematan telah dibersihkan. Daemon latar belakang akan membangun kembali indeks semantik secara inkremental.');
                      window.dispatchEvent(new Event('semantic_cache_cleared'));
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 font-medium text-sm transition-colors shadow-sm"
                >
                  <RefreshCcw size={16} />
                  Bersihkan Cache Penyematan (Clear Vector Cache)
                </button>
              </div>
            </section>

            {/* Manual Backup */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-indigo-500" />
                <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Operasi Manual</h3>
              </div>
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ekspor seluruh ruang kerja Anda atau pulihkan dari cadangan JSON yang ada. Memulihkan akan menimpa data yang ada.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Download size={18} className="text-slate-500 dark:text-slate-400" />
                    {isBackingUp ? 'Mengekspor...' : 'Ekspor Semua Cadangan'}
                  </button>

                  <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  
                  <button
                    onClick={handleRestoreClick}
                    disabled={isRestoring}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Upload size={18} className="text-slate-500 dark:text-slate-400" />
                    {isRestoring ? 'Memulihkan...' : 'Kembalikan dari JSON'}
                  </button>
                </div>
              </div>
            </section>

            {/* Auto-Backup */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCcw size={18} className="text-indigo-500" />
                  <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Mesin Pencadangan Otomatis</h3>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100 dark:border-indigo-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Aktif
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Database size={16} className="text-indigo-500" />
                        Lapisan 1: IndexedDB
                      </div>
                      {lastBackupTime && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Terakhir: {format(lastBackupTime, 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                      Penyimpanan bergulir yang hening di dalam penyimpanan peramban Anda. Menyimpan hingga 5 versi riwayat secara otomatis.
                    </p>
                  </div>
                  <button
                    onClick={triggerManualBackup}
                    disabled={isAutoBackingUp}
                    className="w-full h-10 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium transition-colors border border-indigo-100 dark:border-indigo-800/30 disabled:opacity-50"
                  >
                    {isAutoBackingUp ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    Picu Pencadangan Lokal
                  </button>
                </div>

                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <FolderOpen size={16} className="text-indigo-500" />
                        Lapisan 2: Folder Lokal
                      </div>
                    </div>
                    {!isFileSystemSupported ? (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded-lg text-xs border border-amber-200 dark:border-amber-900/50 my-2">
                        API Sistem File tidak didukung di peramban ini. Harap gunakan Chrome/Edge untuk sinkronisasi folder luring.
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                        Menulis file cadangan `.json` secara terus menerus ke dalam folder di dalam perangkat Anda.
                      </p>
                    )}
                  </div>
                  
                  {isFileSystemSupported && (
                    folderName ? (
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FolderOpen size={16} className="text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{folderName}</span>
                        </div>
                        <button onClick={selectFolder} className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 font-medium px-2">Ubah</button>
                      </div>
                    ) : (
                      <button
                        onClick={selectFolder}
                        className="w-full h-10 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                      >
                        <FolderOpen size={16} />
                        Pilih Folder Cadangan
                      </button>
                    )
                  )}
                </div>

                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm md:col-span-2 flex flex-col md:flex-row gap-6">
                  {/* Interval */}
                  <div className="w-full md:w-1/3 space-y-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Interval
                    </label>
                    <select 
                      value={backupInterval}
                      onChange={(e) => handleIntervalChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                    >
                      <option value="15">Setiap 15 Menit</option>
                      <option value="30">Setiap 30 Menit</option>
                      <option value="60">Setiap 1 Jam</option>
                    </select>
                  </div>

                  {/* Internal History */}
                  <div className="w-full md:w-2/3 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 flex flex-col">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                      <History size={14} />
                      Titik Pulih
                    </div>
                    <div className="flex-1 space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                      {internalBackups && internalBackups.length > 0 ? (
                        internalBackups.map((backup) => (
                          <div key={backup.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700/50 transition-colors group">
                            <div className="flex flex-col">
                              <span className="text-slate-900 dark:text-slate-200 text-xs font-semibold">
                                {format(backup.timestamp, 'MMM d, yyyy • HH:mm:ss')}
                              </span>
                              <span className="text-slate-500 dark:text-slate-500 text-[10px]">
                                Ukuran: {(backup.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <button 
                              onClick={() => handleInternalRestore(backup.id!, backup.timestamp)}
                              className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded-md text-[11px] font-medium transition-all shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              Pulihkan
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-lg">
                          Belum ada titik pemulihan tersedia.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

