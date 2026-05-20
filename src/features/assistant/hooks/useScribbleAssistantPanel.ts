import { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '@/src/db';
import { getActiveWindowText } from '@/src/lib/editorUtils';
import { useAvailableProviders } from '@/src/hooks/useAvailableProviders';
import { useChatSession } from '@/src/hooks/useChatSession';
import { useToast } from '@/src/hooks/useToast';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { Editor } from '@tiptap/core';
import { ChatMessage, CodexEntry, StoryBibleRule } from '@/src/types';
import { useMentionAutocomplete } from '@/src/hooks/useMentionAutocomplete';

interface UseScribbleAssistantPanelProps {
  projectId: number;
  chapterId?: number;
  currentText: string;
  viewMode?: string;
  codexEntries?: CodexEntry[];
  bibleRules?: StoryBibleRule[];
  editor?: Editor | null;
}

export function useScribbleAssistantPanel({
  projectId,
  chapterId,
  currentText,
  viewMode = 'write',
  codexEntries = [],
  bibleRules = [],
  editor
}: UseScribbleAssistantPanelProps) {
  const { 
    availableProviders, 
    selectedProvider, 
    setSelectedProvider 
  } = useAvailableProviders();

  const [sessionId, setSessionId] = useState<number | null>(null);

  const {
    messages,
    setMessages,
    isLoading,
    sendMessage
  } = useChatSession({
    projectId,
    chapterId,
    codexEntries,
    bibleRules,
    provider: selectedProvider,
    onMessageAdded: async (newMessages) => {
      if (sessionId) {
        await db.chatSessions.update(sessionId, {
          messages: newMessages,
          lastMessageAt: Date.now()
        });
      }
    }
  });

  // Load or create session based on chapterId
  useEffect(() => {
    const loadSession = async () => {
      if (!projectId) return;

      const session = await db.chatSessions
        .where('projectId').equals(projectId)
        .and(s => s.chapterId === chapterId)
        .first();

      if (session && session.id) {
        setSessionId(session.id);
        setMessages(session.messages);
      } else {
        const welcomeMsg: ChatMessage = { 
          id: '1', 
          role: 'model', 
          content: 'Halo! Saya Scribble Assistant. Saya memantau draf Anda secara real-time untuk membantu detail lore atau brainstorming cepat di sini.',
          isWelcome: true,
          timestamp: Date.now()
        };

        const newId = await db.chatSessions.add({
          projectId,
          chapterId,
          title: chapterId ? `Chapter ${chapterId} Scribble` : 'Global Scribble',
          lastMessageAt: Date.now(),
          messages: [welcomeMsg]
        });
        
        setSessionId(newId);
        setMessages([welcomeMsg]);
      }
    };

    loadSession();
  }, [projectId, chapterId, setMessages]);

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mentionState = useMentionAutocomplete(codexEntries, bibleRules);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasReceivedReply = messages.some(m => m.role === 'model' && !m.isWelcome);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const suggestedPrompts = useMemo(() => {
    switch (viewMode) {
      case 'codex':
        return [
          "Bantu kembangkan latar belakang karakter ini",
          "Berikan ide konflik untuk entri ini",
          "Apa rahasia yang mungkin disembunyikan?"
        ];
      case 'outline':
        return [
          "Berikan ide plot twist yang mengejutkan",
          "Bantu menyusun klimaks cerita",
          "Apakah ada masalah pacing di bab ini?"
        ];
      case 'bible':
        return [
          "Saran tema cerita yang lebih kuat",
          "Bantu memperhalus premis cerita",
          "Buat aturan naratif dunia (worldbuilding)"
        ];
      case 'write':
      default:
        return [
          "Evaluasi alur cerita sejauh ini",
          "Berikan ide untuk adegan selanjutnya",
          "Bagaimana cara membuat cerita lebih emosional?"
        ];
    }
  }, [viewMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const { toast } = useToast();
  const { setViewMode } = useNavigation();

  const handleClear = async () => {
    const welcomeMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'model', 
      content: 'Halo! Saya Scribble Assistant. Saya memantau draf Anda secara real-time untuk membantu detail lore atau brainstorming cepat di sini.',
      isWelcome: true,
      timestamp: Date.now()
    };
    
    setMessages([welcomeMsg]);
    if (sessionId) {
      await db.chatSessions.update(sessionId, {
        messages: [welcomeMsg],
        lastMessageAt: Date.now()
      });
    }
  };

  const handleSend = async (textToProcess?: string) => {
    const textToSend = textToProcess || input;
    if (!textToSend.trim() || isLoading) return;

    if (!textToProcess) setInput('');

    try {
      const cursorPosition = editor 
        ? editor.state.doc.textBetween(0, editor.state.selection.from, ' ').length
        : 0;
      const focusedContext = editor 
        ? getActiveWindowText(currentText, cursorPosition, 1500)
        : currentText.substring(0, 1500);

      await sendMessage(textToSend, focusedContext);
      
      // Update the last message to be actionable
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
           const updated = [...prev];
           updated[updated.length - 1] = { ...last, isActionable: true, id: Date.now().toString() };
           return updated;
        }
        return prev;
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Maaf, saya mengalami kesalahan saat memerinci lore Anda.';
      
      if (err.code === 'INVALID_KEY' || err.code === 'QUOTA_EXCEEDED') {
        toast.error(errorMessage, {
          action: {
            label: 'Buka Pengaturan',
            onClick: () => setViewMode('settings')
          }
        });
      } else {
        toast.error(errorMessage);
      }

      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: `**Error:** ${errorMessage}`, 
        isError: true, 
        timestamp: Date.now() 
      }]);
    }
  };

  return {
    availableProviders,
    selectedProvider,
    setSelectedProvider,
    messages,
    isLoading,
    input,
    setInput,
    copiedId,
    mentionState,
    messagesEndRef,
    inputRef,
    hasReceivedReply,
    suggestedPrompts,
    handleCopy,
    handleClear,
    handleSend,
  };
}
