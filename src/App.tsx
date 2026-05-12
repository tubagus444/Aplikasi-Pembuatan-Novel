/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from './lib/utils';
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/Toast';
import { useAppContext } from './AppContext';
import { useGlobalEvents } from './hooks/useGlobalEvents';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MainView } from './components/layout/MainView';

export default function App() {
  const { 
    projectId, 
    isFocusMode, 
    setIsSearchOpen 
  } = useAppContext();

  // Handle global keyboard shortcuts and errors
  useGlobalEvents({ setIsSearchOpen });

  if (!projectId) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-slate-400 dark:text-slate-500 font-mono text-xs uppercase tracking-widest">
        Initialising AetherScribe...
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className={cn(
        "flex h-screen bg-background text-foreground overflow-hidden font-sans transition-all duration-700",
        isFocusMode && "bg-secondary"
      )}>
        <Sidebar />
        
        <div className="flex-1 flex flex-col relative bg-background">
          <Header />
          <MainView />
        </div>

        <ToastContainer />
      </div>
    </ToastProvider>
  );
}
