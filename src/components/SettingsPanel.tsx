import React, { useState, useEffect, useRef } from 'react';
import { Save, Check, Database, Upload, Download, AlertTriangle, RefreshCcw, XCircle, Loader2, FolderOpen, History, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { testConnection } from '../services/ai';
import { cn } from '../lib/utils';
import { useAutoBackup } from '../hooks/useAutoBackup';
import { backupService } from '../services/backupService';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { useStorageQuota } from '../hooks/useStorageQuota';
import { ContextDepth } from '../types';
import { OpenRouterModelSelect } from './OpenRouterModelSelect';

export function SettingsPanel() {
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
      `WARNING: This will replace ALL your current data with the backup from ${format(timestamp, 'PPP p')}. This action cannot be undone.\n\nAre you sure you want to proceed?`
    );

    if (!confirmRestore) return;

    try {
      await backupService.restoreFromBackup(backupId);
      alert("Restore completed successfully! The page will now reload.");
      window.location.reload();
    } catch (err) {
      console.error("Internal restore failed:", err);
      alert("Failed to restore from internal backup.");
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
    claude: ''
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [testStatuses, setTestStatuses] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({
    google: 'idle',
    groq: 'idle',
    openrouter: 'idle',
    claude: 'idle'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      claude: loadModel('claude')
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_context_depth', contextDepth);
    
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
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestStatus = async (prov: string) => {
    const key = keys[prov as keyof typeof keys]?.trim();
    if (!key) return;

    const model = models[prov as keyof typeof models]?.trim();

    setTestStatuses(prev => ({ ...prev, [prov]: 'loading' }));
    try {
      const ok = await testConnection(prov, key, model);
      setTestStatuses(prev => ({ ...prev, [prov]: ok ? 'success' : 'error' }));
    } catch (error) {
      setTestStatuses(prev => ({ ...prev, [prov]: 'error' }));
    } finally {
      setTimeout(() => {
        setTestStatuses(prev => ({ ...prev, [prov]: 'idle' }));
      }, 3000);
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
      alert('Failed to create backup. See console for details.');
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
          throw new Error("Invalid backup file format");
        }

        const confirmRestore = window.confirm(
          "WARNING: This will replace ALL your current projects, chapters, codex entries, and settings with the data from the backup file. This action cannot be undone.\n\nAre you sure you want to proceed?"
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

        alert("Restore completed successfully! The page will now reload.");
        window.location.reload();
      } catch (error) {
        console.error('Failed to restore backup:', error);
        alert('Failed to restore from backup file. Make sure it is a valid AetherScribe backup JSON.');
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your API keys, preferences, and data.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Default AI Provider
          </label>
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="google">Google AI Studio (Gemini)</option>
            <option value="groq">Groq Cloud</option>
            <option value="openrouter">OpenRouter</option>
            <option value="claude">Anthropic (Claude)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BrainCircuit size={16} className="text-indigo-500" />
              Context Depth (Token Saver)
            </label>
            <span className={cn(
              "text-[10px] font-bold uppercase py-0.5 px-2 rounded-full",
              contextDepth === 'minimal' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
              contextDepth === 'balanced' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
              contextDepth === 'deep' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              {contextDepth === 'minimal' ? 'Eco mode' : contextDepth === 'balanced' ? 'Optimal' : 'Power mode'}
            </span>
          </div>
          <select 
            value={contextDepth}
            onChange={(e) => setContextDepth(e.target.value as ContextDepth)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="minimal">Minimal (Cheapest) - Core rules only, no lore.</option>
            <option value="balanced">Balanced (Recommended) - Relevant rules + relevant lore.</option>
            <option value="deep">Deep (Rich) - More lore detail + story beats (Tokens heavy).</option>
          </select>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
            {contextDepth === 'minimal' && "Best for saving tokens. AI might forget specific character details or names but follows style."}
            {contextDepth === 'balanced' && "Smart context switching. Uses vector search to find and send only what's needed."}
            {contextDepth === 'deep' && "Maximum quality. Sends larger lore snippets and chapter outlines. Increases token cost significantly."}
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">API Keys</h3>
          
          {[
            { id: 'google', name: 'Google AI Studio (Gemini)', placeholder: 'AIzaSy...' },
            { id: 'groq', name: 'Groq Cloud', placeholder: 'gsk_...' },
            { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
            { id: 'claude', name: 'Claude (Anthropic)', placeholder: 'sk-ant-...' },
          ].map((item) => (
            <div key={item.id}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {item.name}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <input 
                    type="password" 
                    value={keys[item.id as keyof typeof keys]}
                    onChange={(e) => setKeys({...keys, [item.id]: e.target.value})}
                    placeholder={`API Key: ${item.placeholder}`}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {item.id === 'openrouter' ? (
                    <OpenRouterModelSelect 
                      value={models.openrouter}
                      onChange={(val) => setModels({...models, openrouter: val})}
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={models[item.id as keyof typeof models]}
                      onChange={(e) => setModels({...models, [item.id]: e.target.value})}
                      placeholder="Model name (e.g. gpt-4o, claude-3-5-sonnet...)"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleTestStatus(item.id)}
                  disabled={!keys[item.id as keyof typeof keys] || testStatuses[item.id] === 'loading'}
                  title="Check Connection"
                  className={cn(
                    "px-3 py-2 rounded-md border transition-all flex items-center justify-center min-w-[80px]",
                    testStatuses[item.id] === 'idle' && "bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700 hover:bg-slate-50",
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
                    {testStatuses[item.id] === 'idle' && 'Check'}
                    {testStatuses[item.id] === 'loading' && '...'}
                    {testStatuses[item.id] === 'success' && 'Connected'}
                    {testStatuses[item.id] === 'error' && 'Failed'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 flex justify-end">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            {isSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Database size={20} className="text-indigo-500" />
          <h3 className="text-lg font-semibold tracking-tight">Data Backup & Restore</h3>
        </div>
        
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Export your entire workspace (including all projects, chapters, codex entries, story bible rules, and timelines) to a single JSON file. You can restore this file later.
        </p>

        <div className="flex gap-4">
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {isBackingUp ? 'Exporting...' : 'Export Full Backup'}
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
            className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900/50 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            {isRestoring ? 'Restoring...' : 'Restore from Backup'}
          </button>
        </div>
        
        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-xs leading-relaxed border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <p>
            <strong>Warning:</strong> Restoring from a backup will immediately <strong>overwrite</strong> all your current data on this browser. Please ensure you have backed up your current progress before restoring.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <RefreshCcw size={20} className="text-indigo-500" />
            <h3 className="text-lg font-semibold tracking-tight">Auto-Backup</h3>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Reliability Layer Active
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Database size={16} className="text-indigo-500" />
                  Layer 1: Internal DB
                </div>
                {lastBackupTime && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Last: {format(lastBackupTime, 'HH:mm')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Rolling backup stored in IndexedDB. Keeps the last 5 versions automatically.
              </p>
              <button
                onClick={triggerManualBackup}
                disabled={isAutoBackingUp}
                className="w-full h-9 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isAutoBackingUp ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                Backup Now
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                <FolderOpen size={16} className="text-indigo-500" />
                Layer 2: Local Folder
              </div>
              {!isFileSystemSupported ? (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-[10px] border border-red-100 dark:border-red-900/50">
                  File System Access API is not supported in this browser.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Saves a backup file to your computer automatically at every interval.
                  </p>
                  {folderName ? (
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FolderOpen size={12} className="text-slate-400" />
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{folderName}</span>
                      </div>
                      <button onClick={selectFolder} className="text-[10px] text-indigo-500 hover:underline shrink-0">Change</button>
                    </div>
                  ) : (
                    <button
                      onClick={selectFolder}
                      className="w-full h-9 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium transition-colors"
                    >
                      <FolderOpen size={14} />
                      Select Backup Folder
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                Backup Interval
              </label>
              <select 
                value={backupInterval}
                onChange={(e) => handleIntervalChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="15">Every 15 Minutes</option>
                <option value="30">Every 30 Minutes</option>
                <option value="60">Every 1 Hour</option>
              </select>
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                <History size={14} />
                Internal History
              </div>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                {internalBackups && internalBackups.length > 0 ? (
                  internalBackups.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-800 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-slate-100 font-medium">
                          {format(backup.timestamp, 'MMM d, HH:mm')}
                        </span>
                        <span className="text-slate-500 dark:text-slate-500 text-[9px]">
                          {(backup.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button 
                        onClick={() => handleInternalRestore(backup.id!, backup.timestamp)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400 italic">
                    No internal backups yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

