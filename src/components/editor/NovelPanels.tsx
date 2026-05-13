/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Editor } from '@tiptap/core';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useEditorPanel } from '../../EditorPanelContext';
import { PANEL_WIDTH } from '../../lib/constants';
import { db } from '../../db';

// Lazy load side panels
const AIAssistantPanel = React.lazy(() => import('../AIAssistantPanel').then(m => ({ default: m.AIAssistantPanel })));
const SnapshotPanel = React.lazy(() => import('../SnapshotPanel').then(m => ({ default: m.SnapshotPanel })));
const TimelinePanel = React.lazy(() => import('../TimelinePanel').then(m => ({ default: m.TimelinePanel })));
const ProseInsights = React.lazy(() => import('../ProseInsights').then(m => ({ default: m.ProseInsights })));

interface NovelPanelsProps {
  projectId: number;
  chapterId: number;
  editor: Editor | null;
  codexEntries: any[];
  bibleRules: any[];
}

export function NovelPanels({ projectId, chapterId, editor, codexEntries, bibleRules }: NovelPanelsProps) {
  const { activePanel, setActivePanel } = useEditorPanel();
  
  return (
    <AnimatePresence>
      <React.Suspense fallback={
        <div className="h-full border-l border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50/50" style={{ width: activePanel !== 'none' ? PANEL_WIDTH : 0 }}>
          {activePanel !== 'none' && <Loader2 className="animate-spin text-slate-300" size={24} />}
        </div>
      }>
        {activePanel !== 'none' && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <div className="h-full flex flex-col" style={{ width: PANEL_WIDTH }}>
              {activePanel === 'assistant' && (
                <AIAssistantPanel 
                  projectId={projectId} 
                  chapterId={chapterId}
                  currentText={editor?.getText() || ''} 
                  onClose={() => setActivePanel('none')} 
                  onInsertText={(text) => {
                    editor?.commands.insertContent('\n\n' + text);
                  }}
                  codexEntries={codexEntries}
                  bibleRules={bibleRules}
                  editor={editor}
                />
              )}

              {activePanel === 'snapshots' && (
                <SnapshotPanel 
                  chapterId={chapterId} 
                  currentContent={editor?.getHTML() || ''} 
                  onRestore={(text) => {
                    editor?.commands.setContent(text);
                    db.chapters.update(chapterId, { content: text, lastModified: Date.now() });
                    setActivePanel('none');
                  }} 
                />
              )}

              {activePanel === 'timeline' && (
                <TimelinePanel chapterId={chapterId} projectId={projectId} />
              )}

              {activePanel === 'insights' && (
                <ProseInsights content={editor?.getText() || ''} />
              )}
            </div>
          </motion.div>
        )}
      </React.Suspense>
    </AnimatePresence>
  );
}
