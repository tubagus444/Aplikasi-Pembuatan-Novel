import React, { useState, useRef, useEffect } from 'react';
import { Plus, BrainCircuit } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../lib/utils';
import { SessionMode } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { useChatSession } from '../hooks/useChatSession';
import { useToast } from '../hooks/useToast';
import { useNavigation } from '../contexts/NavigationContext';
import { SessionModeSelector } from './SessionModeSelector';
import { splitIntoScenes, getRelevantScenes, getLastScene, buildExcerptContext, Scene } from '../lib/chunkEngine';
import { useMentionAutocomplete } from '../hooks/useMentionAutocomplete';

// New Sub-components
import { BrainstormSidebar } from './brainstorm/BrainstormSidebar';
import { BrainstormHeader } from './brainstorm/BrainstormHeader';
import { BrainstormMessageList } from './brainstorm/BrainstormMessageList';
import { BrainstormInputArea } from './brainstorm/BrainstormInputArea';

export function AIBrainstormStudio() {
  const { projectId } = useProject();
  const { activeChapterId } = useNavigation();
  const { toast } = useToast();
  
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  
  const pendingInputRef = useRef<string | null>(null);

  const codexEntries = useLiveQuery(() => 
    projectId ? db.codex.where('projectId').equals(projectId).toArray() : []
  , [projectId]);

  const bibleRules = useLiveQuery(() => 
    projectId ? db.bible.where('projectId').equals(projectId).toArray() : []
  , [projectId]);

  const chapters = useLiveQuery(() => 
    projectId ? db.chapters.where('projectId').equals(projectId).sortBy('order') : []
  , [projectId]);

  const {
    isOpen: isMentionOpen,
    setIsOpen: setIsMentionOpen,
    suggestions: mentionSuggestions,
    selectedIndex: mentionSelectedIndex,
    handleInputChange: handleMentionInputChange,
    handleKeyDown: handleMentionKeyDown,
    selectMention
  } = useMentionAutocomplete(codexEntries || [], bibleRules || []);

  const sessions = useLiveQuery(() => 
    projectId ? db.chatSessions.where('projectId').equals(projectId).reverse().sortBy('lastMessageAt').then(arr => arr.slice(0, 50)) : []
  , [projectId]);

  const activeSession = useLiveQuery(() => 
    activeSessionId ? db.chatSessions.get(activeSessionId) : undefined
  , [activeSessionId]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const {
    messages,
    setMessages,
    isLoading,
    sendMessage
  } = useChatSession({
    projectId: projectId || 0,
    chapterId: activeChapterId || undefined,
    codexEntries: codexEntries || [],
    bibleRules: bibleRules || [],
    sessionMode: activeSession?.mode,
    provider: localStorage.getItem('ai_provider') || 'google',
    initialMessages: activeSession?.messages || [],
    onMessageAdded: async (newMessages) => {
      if (activeSessionIdRef.current) {
        await db.chatSessions.update(activeSessionIdRef.current, {
          messages: newMessages,
          lastMessageAt: Date.now()
        });
      }
    }
  });

  // Sync messages ONLY on session change to prevent overwrite loops
  useEffect(() => {
    let isSubscribed = true;
    if (activeSessionId) {
      db.chatSessions.get(activeSessionId).then(session => {
        if (session && isSubscribed) setMessages(session.messages);
      });
    } else {
      setMessages([]);
    }
    return () => { isSubscribed = false; };
  }, [activeSessionId, setMessages]);


  const codexRef = useRef(codexEntries);
  useEffect(() => {
    codexRef.current = codexEntries;
  }, [codexEntries]);


  const createSession = async () => {
    setShowModeSelector(true);
  };

  const executeCreateSession = async (mode: SessionMode, smartAuto: boolean) => {
    if (!projectId) return;
    const newId = await db.chatSessions.add({
      projectId,
      title: 'Percakapan Baru',
      lastMessageAt: Date.now(),
      messages: [],
      mode,
      smartAutoEnabled: smartAuto,
      activeChapterId: activeChapterId || undefined
    });
    setActiveSessionId(newId);
    activeSessionIdRef.current = newId; // Update ref immediately
    setShowModeSelector(false);

    if (pendingInputRef.current) {
      const textToSend = pendingInputRef.current;
      pendingInputRef.current = null;
      setInput('');
      setMessages([]); // clean local state
      
      try {
        const newTitle = textToSend.substring(0, 40) + (textToSend.length > 40 ? '...' : '');
        await db.chatSessions.update(newId, { title: newTitle });
        await sendMessage(textToSend, chapterContext);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Gagal mengirim pesan.');
      }
    }
  };

  const [showModeSelector, setShowModeSelector] = useState(false);
  
  const [chapterContext, setChapterContext] = useState('');
  const [sceneMetadata, setSceneMetadata] = useState<{ name: string; wordCount: number; isManual: boolean; manualType?: 'excerpt' | 'summary' } | null>(null);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const scenesRef = useRef(scenes);

  const sessionChapterId = activeSession?.activeChapterId || activeChapterId;
  const sessionChapter = chapters?.find(c => c.id === sessionChapterId);

  // Split scenes only when chapter content changes
  useEffect(() => {
    if (sessionChapter?.content) {
      const splitScenes = splitIntoScenes(sessionChapter.content);
      setScenes(splitScenes);
      scenesRef.current = splitScenes;
    } else {
      setScenes([]);
      scenesRef.current = [];
    }
  }, [sessionChapter?.id, sessionChapter?.content]);

  // Run chunk engine on input change
  const isSmartAuto = activeSession?.smartAutoEnabled;

  useEffect(() => {
    if (isSmartAuto === undefined && activeSessionId) return; // wait for session loaded unless null
    
    const hasManualExcerpt = input.includes('@chapter-excerpt');
    const hasManualSummary = input.includes('@chapter-summary');

    if (hasManualExcerpt) {
      if (sessionChapter && sessionChapter.content) {
        const lastScene = getLastScene(scenesRef.current);
        if (lastScene) {
          setChapterContext(buildExcerptContext([lastScene]));
          setSceneMetadata({
            name: `Scene ${lastScene.index + 1}`,
            wordCount: lastScene.wordCount,
            isManual: true,
            manualType: 'excerpt'
          });
        }
      }
      return;
    }

    if (hasManualSummary) {
      if (sessionChapter && sessionChapter.summary) {
        setChapterContext(`[CHAPTER SUMMARY]\n${sessionChapter.summary}\n[END SUMMARY]`);
        setSceneMetadata({ name: 'Chapter Summary', wordCount: sessionChapter.summary.split(/\s+/).length, isManual: true, manualType: 'summary' });
      }
      return;
    }

    if (isSmartAuto && sessionChapterId && scenesRef.current.length > 0) {
      const runEngine = setTimeout(() => {
        const relevant = getRelevantScenes(input, scenesRef.current, codexRef.current || []);
        let chosenData: Scene[] = [];
        let name = '';
        
        if (relevant.length > 0) {
          chosenData = relevant;
          name = relevant.length === 1 ? `Scene ${relevant[0].index + 1}` : `Scenes ${relevant.map(s => s.index + 1).join(' & ')}`;
        } else {
          const last = getLastScene(scenesRef.current);
          if (last) {
            chosenData = [last];
            name = `Scene ${last.index + 1} (Latest)`;
          }
        }
        
        if (chosenData.length > 0) {
          setChapterContext(buildExcerptContext(chosenData));
          setSceneMetadata({
            name,
            wordCount: chosenData.reduce((acc, s) => acc + s.wordCount, 0),
            isManual: false
          });
        }
      }, 500); // 500ms debounce
      
      return () => clearTimeout(runEngine);
    } else if (!hasManualExcerpt && !hasManualSummary) {
      setChapterContext('');
      setSceneMetadata(null);
    }
  }, [input, isSmartAuto, sessionChapter?.id, sessionChapter?.summary, sessionChapter?.content, activeSessionId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !projectId) return;

    // Create session if none active
    if (!activeSessionId) {
      pendingInputRef.current = input;
      setShowModeSelector(true);
      return;
    }

    const textToSend = input;
    setInput('');

    try {
      if (messages.length === 0) {
        const newTitle = textToSend.substring(0, 40) + (textToSend.length > 40 ? '...' : '');
        await db.chatSessions.update(activeSessionId, { title: newTitle });
      }

      await sendMessage(textToSend, chapterContext);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Gagal mengirim pesan ke AI.';
      
      if (err.code === 'INVALID_KEY' || err.code === 'QUOTA_EXCEEDED') {
        toast.error(`${errorMessage} (Cek Pengaturan API)`);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-100">
      <BrainstormSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={createSession}
      />

      <div className={cn(
        "flex-1 flex flex-col relative",
        !activeSessionId ? "hidden lg:flex" : "flex"
      )}>
        {!activeSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 motion-safe:animate-pulse">
              <BrainCircuit size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">AI Brainstorming Studio</h1>
            <p className="max-w-md text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Ruang kerja khusus untuk menyusun plot, mendalami lore, atau sekadar bertukar pikiran dengan asisten cerdas Anda yang terintegrasi dengan Story Bible & Codex.
            </p>
            <button 
              onClick={createSession}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Plus size={20} /> Mulai Diskusi Baru
            </button>
          </div>
        ) : (
          <>
            <BrainstormHeader
              activeSessionId={activeSessionId}
              activeSession={activeSession}
              onBack={() => setActiveSessionId(null)}
              onSessionDeleted={() => setActiveSessionId(null)}
            />

            <BrainstormMessageList
              messages={messages}
              isLoading={isLoading}
            />

            <BrainstormInputArea
              activeSessionId={activeSessionId}
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              handleSend={handleSend}
              sessionChapterId={sessionChapterId}
              chapters={chapters}
              sceneMetadata={sceneMetadata}
              chapterContext={chapterContext}
              setSceneMetadata={setSceneMetadata}
              setChapterContext={setChapterContext}
              codexEntries={codexEntries}
              bibleRules={bibleRules}
              sessionChapter={sessionChapter}
              isMentionOpen={isMentionOpen}
              setIsMentionOpen={setIsMentionOpen}
              mentionSuggestions={mentionSuggestions}
              mentionSelectedIndex={mentionSelectedIndex}
              handleMentionInputChange={handleMentionInputChange}
              handleMentionKeyDown={handleMentionKeyDown}
              selectMention={selectMention}
            />
          </>
        )}
      </div>
      
      {showModeSelector && (
         <SessionModeSelector 
           onSelect={(mode, smartAuto) => executeCreateSession(mode, smartAuto)} 
           onCancel={() => setShowModeSelector(false)} 
         />
      )}
    </div>
  );
}
