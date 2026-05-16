import { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { useToast } from './useToast';
import { useChatSession } from './useChatSession';
import { SessionMode, CodexEntry, StoryBibleRule } from '../types';

export function useBrainstormSession({
  projectId,
  activeChapterId,
  activeSessionId,
  setActiveSessionId,
  activeSession,
  codexEntries,
  bibleRules,
  input,
  setInput,
  chapterContext,
}: {
  projectId: number | null;
  activeChapterId: number | null;
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;
  activeSession: any;
  codexEntries: CodexEntry[];
  bibleRules: StoryBibleRule[];
  input: string;
  setInput: (val: string) => void;
  chapterContext: string;
}) {
  const { toast } = useToast();
  
  const [showModeSelector, setShowModeSelector] = useState(false);
  const pendingInputRef = useRef<string | null>(null);
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

  return {
    showModeSelector,
    setShowModeSelector,
    createSession,
    executeCreateSession,
    handleSend,
    messages,
    isLoading
  };
}
