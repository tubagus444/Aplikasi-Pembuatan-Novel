/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { db } from '@/src/db';
import { useOptimizedLiveQuery } from '@/src/hooks/useOptimizedLiveQuery';
import { useProjectData } from '@/src/hooks/useProjectData';
import { BarChart2, Book, FileText, Clock, Database, HardDrive, Target, Sparkles, Server, AlertTriangle, ScrollText, Network } from 'lucide-react';
import { countWords } from '@/src/lib/utils';
import { motion } from 'motion/react';

interface DashboardPanelProps {
  projectId: number;
}

export function DashboardPanel({ projectId }: DashboardPanelProps) {
  const [storageInfo, setStorageInfo] = useState<{ usage: number, quota: number } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const project = useOptimizedLiveQuery(() => db.projects.get(projectId), [projectId]);
  const chapters = useOptimizedLiveQuery(() => db.chapters.where('projectId').equals(projectId).toArray(), [projectId]);
  const { codexEntries, aiActions, bibleRules } = useProjectData(projectId);
  
  const systemStats = useOptimizedLiveQuery(async () => {
    return {
      snapshots: await db.snapshots.count(),
      backups: await db.backups.count(),
      errors: await db.errors.count()
    };
  }, []);

  const aiStats = useOptimizedLiveQuery(async () => {
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

    const topModels = Object.entries(modelUsage).sort((a,b) => b[1] - a[1]).slice(0, 3);

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
    <div className="max-w-5xl mx-auto pb-24 mt-6">
      <header className="mb-10 px-2 lg:px-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
            <BarChart2 className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Dashboard Proyek
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Ringkasan statistik, progres naskah, dan telemetri sistem.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 px-2 lg:px-0">
        {/* Progress Card - Full Width */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-8 shadow-sm flex flex-col justify-center overflow-hidden relative col-span-1 md:col-span-12 group">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl transition-all duration-700 group-hover:scale-110 pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl transition-all duration-700 group-hover:scale-110 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="flex-1 w-full shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <Target size={20} className="text-indigo-500" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                  Target Progres Naskah
                </h3>
              </div>
              
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{progressPercent}%</span>
                <span className="text-slate-500 dark:text-slate-400 font-medium ml-2">{totalWords.toLocaleString()} / {wordGoal.toLocaleString()} kata</span>
              </div>
              
              <div className="h-4 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden w-full shadow-inner ring-1 ring-black/5 dark:ring-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full h-full transform skew-x-12 translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 shrink-0 lg:ml-auto w-full lg:w-auto">
               <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 flex-1 flex flex-col justify-center min-w-[140px]">
                 <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                   <Clock size={16} />
                   <p className="text-xs font-bold uppercase tracking-wider">Est. Baca</p>
                 </div>
                 <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{readTimeMin} <span className="text-lg font-medium text-slate-500">mnt</span></p>
               </div>
               
               <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 flex-1 flex flex-col justify-center min-w-[140px]">
                 <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                   <FileText size={16} />
                   <p className="text-xs font-bold uppercase tracking-wider">Bab Aktif</p>
                 </div>
                 <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{chapters?.length || 0}</p>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Content Metrics */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-7 shadow-sm col-span-1 md:col-span-6 lg:col-span-4 flex flex-col">
           <div className="flex items-center gap-4 mb-6">
             <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl shadow-inner border border-amber-200/50 dark:border-amber-700/30">
               <Book size={24} />
             </div>
             <div>
               <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100">Data Lore & Dunia</h3>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Informasi ensiklopedia</p>
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4 mt-auto">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">{codexEntries.length}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Entri Codex</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">{bibleRules.length}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Aturan Dasar</div>
              </div>
           </div>
        </motion.div>

        {/* AI Metrics */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-7 shadow-sm col-span-1 md:col-span-6 lg:col-span-4 flex flex-col">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl shadow-inner border border-fuchsia-200/50 dark:border-fuchsia-700/30">
                 <Sparkles size={24} />
               </div>
               <div>
                 <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100">Aktivitas AI</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Penggunaan model & sesi</p>
               </div>
             </div>
           </div>
           
           <div className="space-y-4 flex-1">
             <div className="bg-fuchsia-50/50 dark:bg-fuchsia-900/10 rounded-2xl p-4 flex justify-between items-center border border-fuchsia-100 dark:border-fuchsia-900/20">
               <div>
                 <div className="text-2xl font-black text-fuchsia-700 dark:text-fuchsia-300">{(aiStats?.totalTokensThisWeek || 0).toLocaleString()}</div>
                 <div className="text-xs font-semibold text-fuchsia-600/70 dark:text-fuchsia-400/70">Total Token (7 Hari Terakhir)</div>
               </div>
               <Network size={32} className="text-fuchsia-300/50 dark:text-fuchsia-700/50 stroke-1" />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sesi Chat</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{aiStats?.activeSessions ?? 0}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Snippets</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{aiActions.length}</span>
                </div>
             </div>
           </div>
        </motion.div>
        
        {/* System Details */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-7 shadow-sm col-span-1 md:col-span-12 lg:col-span-4 flex flex-col">
           <div className="flex items-center gap-4 mb-6">
             <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-inner border border-emerald-200/50 dark:border-emerald-700/30">
               <Server size={24} />
             </div>
             <div>
               <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100">Telemetri Sistem</h3>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status dan kapasitas lokal</p>
             </div>
           </div>
           
           <div className="space-y-4 mt-auto">
             {/* Storage Block */}
             <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
               <div className="flex justify-between items-baseline mb-2">
                 <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Penyimpanan Terpakai</span>
                 <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                   {storageInfo ? formatBytes(storageInfo.usage) : '---'}
                 </span>
               </div>
               {storageInfo && storageInfo.quota > 0 ? (
                 <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden w-full shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${
                        (storageInfo.usage / storageInfo.quota) > 0.8 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (storageInfo.usage / storageInfo.quota) * 100)}%` }}
                    />
                 </div>
               ) : (
                 <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-full"></div>
               )}
               <div className="flex justify-between mt-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                 <span>0%</span>
                 <span>Sisa: {storageInfo ? formatBytes(storageInfo.quota - storageInfo.usage) : '---'}</span>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-3">
               <div className="flex flex-col p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30">
                 <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status Koneksi</span>
                 <div className="flex items-center gap-2">
                   <div className="relative flex h-2.5 w-2.5">
                     {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                     <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                   </div>
                   <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                     {isOnline ? 'ONLINE' : 'OFFLINE'}
                   </span>
                 </div>
               </div>
               <div className="flex flex-col p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 justify-center">
                 <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Skema DB</span>
                 <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                    v{db.verno}
                 </span>
               </div>
             </div>
             
             <div className="flex items-center justify-between text-xs font-medium px-1">
               <span className="text-slate-500">Backups: <strong className="text-slate-800 dark:text-slate-200">{systemStats?.backups ?? 0}</strong></span>
               <span className="text-slate-500">Snapshots: <strong className="text-slate-800 dark:text-slate-200">{systemStats?.snapshots ?? 0}</strong></span>
               <span className={`${(systemStats?.errors ?? 0) > 0 ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                 Errors: <strong className="text-slate-800 dark:text-slate-200">{systemStats?.errors ?? 0}</strong>
               </span>
             </div>
           </div>
        </motion.div>

      </div>
    </div>
  );
}

