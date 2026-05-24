/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '@/src/lib/utils';

interface EditorLayoutProps {
  isFocusMode: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  header: React.ReactNode;
  toolbar?: React.ReactNode;
  footer: React.ReactNode;
  panels: React.ReactNode;
}

export function EditorLayout({ 
  isFocusMode, 
  containerRef, 
  children, 
  header,
  toolbar,
  footer, 
  panels 
}: EditorLayoutProps) {
  return (
    <div className="flex h-full relative overflow-hidden bg-slate-50 dark:bg-[#0A0D14]">
      {/* Main Editing Column */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {toolbar && !isFocusMode && (
          <div className="w-full flex justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
            <div className="w-full max-w-[760px]">
              {toolbar}
            </div>
          </div>
        )}
        {/* Scrollable Content Area */}
        <div 
          ref={containerRef} 
          className="flex-1 relative overflow-y-auto scroll-smooth custom-scrollbar py-8 sm:py-12 px-4 sm:px-8"
        >
          {/* Editor Surface */}
          <div className={cn(
            "w-full max-w-[760px] mx-auto flex flex-col min-h-[850px] bg-white dark:bg-[#11141D] px-4 sm:px-12 md:px-20 py-8 sm:py-16 md:py-24 transition-all duration-700 rounded-sm shadow-sm border border-slate-200/50 dark:border-slate-800/50 ring-1 ring-slate-100 dark:ring-white/5",
            isFocusMode && "max-w-[650px] bg-transparent dark:bg-transparent shadow-none border-transparent ring-0 px-3 sm:px-8 py-8 md:py-12"
          )}>
            {header}
            {children}
          </div>
        </div>

        {footer}
      </div>

      {/* Right Panels Column */}
      {panels}
    </div>
  );
}
