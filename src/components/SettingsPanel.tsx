import React, { useState, useEffect } from 'react';
import { Save, Check } from 'lucide-react';
import { motion } from 'motion/react';

export function SettingsPanel() {
  const [provider, setProvider] = useState('google');
  const [keys, setKeys] = useState({
    google: '',
    groq: '',
    openrouter: '',
    claude: ''
  });
  const [isSaved, setIsSaved] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your API keys and AI provider preferences locally. Keys are stored safely in your browser.
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
    </div>
  );
}
