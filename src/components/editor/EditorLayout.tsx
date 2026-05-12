/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EditorLayoutProps {
  isFocusMode: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  panels: React.ReactNode;
}

export function EditorLayout({ 
  isFocusMode, 
  containerRef, 
  children, 
  header, 
  footer, 
  panels 
}: EditorLayoutProps) {
  return (
    <div className="flex h-full relative overflow-hidden bg-white dark:bg-slate-900">
      {/* Main Editing Column */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Scrollable Content Area */}
        <div 
          ref={containerRef} 
          className="flex-1 relative overflow-y-auto scroll-smooth custom-scrollbar pb-16"
        >
          {/* Editor Surface */}
          <div className={cn(
            "w-full max-w-2xl mx-auto flex flex-col min-h-full px-8 sm:px-0 transition-all duration-700",
            isFocusMode && "max-w-xl"
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
