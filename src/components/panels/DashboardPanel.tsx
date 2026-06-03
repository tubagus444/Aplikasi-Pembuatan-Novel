/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProjectData } from '@/src/hooks/useProjectData';
import { BarChart2, Book, FileText, Clock, Database, HardDrive, Target, Sparkles, TrendingUp } from 'lucide-react';
import { countWords } from '@/src/lib/utils';
import { motion } from 'motion/react';

interface DashboardPanelProps {
  projectId: number;
}

export function DashboardPanel({ projectId }: DashboardPanelProps) {
  const [storageInfo, setStorageInfo] = useState<{ usage: number, quota: number } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const chapters = useLiveQuery(() => db.chapters.where('projectId').equals(projectId).toArray(), [projectId]);
  const { codexEntries, aiActions, bibleRules } = useProjectData(projectId);
  
  const systemStats = useLiveQuery(async () => {
    return {
      snapshots: await db.snapshots.count(),
      backups: await db.backups.count(),
      errors: await db.errors.count()
    };
  }, []);

  const aiStats = useLiveQuery(async () => {
    const chatSessions = await db.chatSessions.where('projectId').equals(projectId).toArray();
    let messageCount = 0;
    chatSessions.forEach(s => {
      messageCount += s.messages.length;
    });

    const logs = await db.aiUsageLogs.toArray();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    let totalTokensThisWeek = 0;
    const modelUsage: Record<string, number> = {};
    
    logs.forEach(log => {
        if (log.timestamp > oneWeekAgo) {
            totalTokensThisWeek += log.totalTokens;
        }
        // Normalize provider names somewhat
        let pName = log.provider;
        if (pName === 'google') pName = 'Gemini';
        else if (pName === 'openrouter') pName = 'OpenR';
        
        const label = `${pName} (${log.model})`;
        modelUsage[label] = (modelUsage[label] || 0) + log.totalTokens;
    });

    const topModels = Object.entries(modelUsage).sort((a,b) => b[1] - a[1]).slice(0, 2);

    return {
      activeSessions: chatSessions.length,
      totalMessages: messageCount,
      totalTokensThisWeek,
      topModels
    };
  }, [projectId]);

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        if (usage !== undefined && quota !== undefined) {
          setStorageInfo({ usage, quota });
        }
      }).catch(console.error);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const totalWords = useMemo(() => {
    if (!chapters) return 0;
    return chapters.reduce((acc, ch) => acc + countWords(ch.content), 0);
  }, [chapters]);

  const readTimeMin = Math.ceil(totalWords / 250);
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const wordGoal = project?.wordGoal || 50000;
  const progressPercent = Math.min(100, Math.round((totalWords / wordGoal) * 100));

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <BarChart2 className="text-indigo-500" size={32} />
          Dashboard Proyek
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Ringkasan statistik, progres naskah, dan detail sistem aplikasi.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Progress Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm col-span-1 md:col-span-2 lg:col-span-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Target size={16} className="text-indigo-500"/>
                  Progres Naskah
                </h3>
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{progressPercent}%</span>
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
                <span>{totalWords.toLocaleString()} kata</span>
                <span>Target: {wordGoal.toLocaleString()} kata</span>
              </div>
            </div>
            
            <div className="flex gap-6 shrink-0">
               <div className="text-center">
                 <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{readTimeMin}</p>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Estimasi Baca (Mnt)</p>
               </div>
               <div className="text-center border-l pl-6 border-slate-200 dark:border-slate-700">
                 <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{chapters?.length || 0}</p>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total Bab</p>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Content Metrics */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
             <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
               <Book size={20} />
             </div>
             <h3 className="font-bold text-slate-800 dark:text-slate-200">Data Dunia</h3>
           </div>
           <div className="space-y-4">
             <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Entri Karakter/Lokasi</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm">{codexEntries.length}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Aturan Dasar (Bible)</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm">{bibleRules.length}</span>
             </div>
           </div>
        </motion.div>

        {/* System Detail */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
           <div className="flex items-center gap-3 mb-6">
             <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
               <HardDrive size={20} />
             </div>
             <h3 className="font-bold text-slate-800 dark:text-slate-200">Sistem & Perangkat</h3>
           </div>
           
           <div className="space-y-4">
             {/* Storage Info */}
             <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Penyimpanan Terpakai</span>
                 <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm">
                   {storageInfo ? formatBytes(storageInfo.usage) : 'Menghitung...'}
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Sisa Kuota Browser</span>
                 <span className="font-bold border border-emerald-100 dark:border-emerald-900 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-1 rounded text-sm">
                   {storageInfo ? formatBytes(storageInfo.quota - storageInfo.usage) : 'Menghitung...'}
                 </span>
               </div>
               {storageInfo && storageInfo.quota > 0 && (
                 <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${
                        (storageInfo.usage / storageInfo.quota) > 0.8 ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (storageInfo.usage / storageInfo.quota) * 100)}%` }}
                    />
                 </div>
               )}
             </div>

             {/* Network & Browser */}
             <div className="space-y-3 pt-1">
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Status Aplikasi</span>
                 <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                   <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                   <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                     {isOnline ? 'ONLINE' : 'OFFLINE'}
                   </span>
                 </div>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Engine / Lingkungan</span>
                 <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[140px]" title={navigator.userAgent}>
                   {navigator.userAgent.includes('Chrome') ? 'Chromium' : navigator.userAgent.includes('Firefox') ? 'Gecko' : navigator.userAgent.includes('Safari') ? 'WebKit' : 'Unknown'}
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Standar Waktu Lintas</span>
                 <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Versi Skema DB</span>
                 <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                    v{db.verno}
                 </span>
               </div>
             </div>

             <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3 mt-1">
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Auto-Backups</span>
                 <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {systemStats?.backups ?? 0} file
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Riwayat Snapshot</span>
                 <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {systemStats?.snapshots ?? 0} titik
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Log Error Tersimpan</span>
                 <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                   (systemStats?.errors ?? 0) > 0 
                     ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50' 
                     : 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800'
                 }`}>
                    {systemStats?.errors ?? 0} insiden
                 </span>
               </div>
             </div>
           </div>
        </motion.div>

        {/* AI Metrics */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                 <Sparkles size={20} />
               </div>
               <h3 className="font-bold text-slate-800 dark:text-slate-200">Aktivitas AI</h3>
             </div>
             <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Token (7 Hari)</div>
                <div className="font-bold text-lg text-slate-800 dark:text-slate-100">{(aiStats?.totalTokensThisWeek || 0).toLocaleString()}</div>
             </div>
           </div>
           <div className="space-y-4">
             <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Auto-Aksi (Snippets)</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm">{aiActions.length}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Sesi Diskusi (Chat)</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm">{aiStats?.activeSessions ?? 0}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Pesan AI</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm">{aiStats?.totalMessages ?? 0}</span>
             </div>

             {aiStats?.topModels && aiStats.topModels.length > 0 && (
               <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Top Models (Lifetime)</div>
                  {aiStats.topModels.map(([modelName, tokens]) => (
                    <div key={modelName} className="flex flex-col mb-2 last:mb-0">
                      <div className="flex justify-between items-end mb-1">
                         <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate max-w-[180px]" title={modelName}>{modelName}</span>
                         <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{tokens.toLocaleString()} tk</span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-400/50 dark:bg-purple-500/50" style={{ width: `${Math.min(100, Math.max(5, (tokens / (aiStats.topModels?.[0]?.[1] || 1)) * 100))}%` }}></div>
                      </div>
                    </div>
                  ))}
               </div>
             )}

             <div className="text-xs text-slate-400 mt-4 leading-relaxed font-serif italic border-l-2 border-slate-200 dark:border-slate-700 pl-3">
               Aktivitas AI bergantung pada integrasi model bahasa yang dikonfigurasi melalui layar pengaturan.
             </div>
           </div>
        </motion.div>

      </div>
    </div>
  );
}
