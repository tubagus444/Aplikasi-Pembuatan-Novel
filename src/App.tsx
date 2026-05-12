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
import { motion } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MainView } from './components/layout/MainView';

export default function App() {
  const { 
    projectId, 
    isFocusMode, 
    sidebarOpen,
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

  // Calculate shift: if sidebar is closed OR focus mode is on, we shift left by 260px
  const isSidebarActuallyOpen = sidebarOpen && !isFocusMode;
  const xOffset = isSidebarActuallyOpen ? 0 : -260;

  return (
    <ToastProvider>
      <div className={cn(
        "h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-700",
        isFocusMode && "bg-secondary"
      )}>
        <motion.div 
          animate={{ x: xOffset }}
          transition={{ type: 'spring', damping: 27, stiffness: 220 }}
          className="flex h-full w-[calc(100vw+260px)] will-change-transform"
        >
          <Sidebar />
          
          <div className="w-screen flex flex-col relative bg-background border-l border-slate-200 dark:border-slate-800">
            <Header />
            <MainView />
          </div>
        </motion.div>

        <ToastContainer />
      </div>
    </ToastProvider>
  );
}
