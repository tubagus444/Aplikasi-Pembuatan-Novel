import React, { useState, useEffect, useRef } from 'react';
import { Save, Check, Database, Upload, Download, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../db';

export function SettingsPanel() {
  const [provider, setProvider] = useState('google');
  const [keys, setKeys] = useState({
    google: '',
    groq: '',
    openrouter: '',
    claude: ''
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load from localStorage on mount
    setProvider(localStorage.getItem('ai_provider') || 'google');
    setKeys({
      google: localStorage.getItem('ai_key_google') || '',
      groq: localStorage.getItem('ai_key_groq') || '',
      openrouter: localStorage.getItem('ai_key_openrouter') || '',
      claude: localStorage.getItem('ai_key_claude') || ''
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_key_google', keys.google);
    localStorage.setItem('ai_key_groq', keys.groq);
    localStorage.setItem('ai_key_openrouter', keys.openrouter);
    localStorage.setItem('ai_key_claude', keys.claude);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
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
            if (backup.data.bible?.length) await db.bible.bulkAdd(backup.data.bible);
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

        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">API Keys</h3>
          
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Google AI Studio Key (Gemini)
            </label>
            <input 
              type="password" 
              value={keys.google}
              onChange={(e) => setKeys({...keys, google: e.target.value})}
              placeholder="AIzaSy..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Groq Cloud API Key
            </label>
            <input 
              type="password" 
              value={keys.groq}
              onChange={(e) => setKeys({...keys, groq: e.target.value})}
              placeholder="gsk_..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              OpenRouter API Key
            </label>
            <input 
              type="password" 
              value={keys.openrouter}
              onChange={(e) => setKeys({...keys, openrouter: e.target.value})}
              placeholder="sk-or-..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Claude API Key (Anthropic)
            </label>
            <input 
              type="password" 
              value={keys.claude}
              onChange={(e) => setKeys({...keys, claude: e.target.value})}
              placeholder="sk-ant-..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
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
    </div>
  );
}

