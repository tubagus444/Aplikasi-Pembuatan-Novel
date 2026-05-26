import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, CodexEntry, StoryBibleRule } from '@/src/types';
import { processChat, cancelAI } from '@/src/services/ai';
import { getRelevantContext, getRelevantBibleRules } from '@/src/services/contextEngine';
import { resolveLoreTags } from '@/src/lib/loreUtils';

import { SessionMode } from '@/src/types';

interface UseChatSessionProps {
  projectId: number;
  chapterId?: number;
  codexEntries: CodexEntry[];
  bibleRules: StoryBibleRule[];
  contextText?: string;
  sessionMode?: SessionMode;
  provider?: string;
  initialMessages?: ChatMessage[];
  onMessageAdded?: (messages: ChatMessage[]) => void;
  onResponseReceived?: (response: string) => void;
  onError?: (error: string) => void;
}

export function useChatSession({
  projectId,
  chapterId,
  codexEntries,
  bibleRules,
  contextText = '',
  sessionMode,
  provider = 'google',
  initialMessages = [],
  onMessageAdded,
  onResponseReceived,
  onError
}: UseChatSessionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef(messages);
  const isLoadingRef = useRef(false);

  // Keep refs in sync for sendMessage accessibility
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    return () => {
      cancelAI('chat');
    };
  }, []);

  const sendMessage = useCallback(async (text: string, customContext?: string) => {
    if (!text.trim() || isLoadingRef.current) return;

    const userMsg: ChatMessage = { 
      id: Date.now().toString(),
      role: 'user', 
      content: text, 
      timestamp: Date.now() 
    };
    
    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages, userMsg];
    setMessages(newMessages);
    messagesRef.current = newMessages; // Immediate update for rapid fire messages
    onMessageAdded?.(newMessages);
    setIsLoading(true);
    isLoadingRef.current = true;

    try {
      // 0. Resolve lore tags for AI consumption
      const resolvedText = resolveLoreTags(text, codexEntries, bibleRules);

      // 1. Prepare history for AI
      const history = newMessages
        .slice(-10) // Limit history to last 10 messages for performance
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      // 2. Process chat (RAG logic handled inside processChat)
      let currentReply = "";
      const assistantMsgId = Date.now().toString() + "_assistant";
      
      const reply = await processChat({
        message: resolvedText,
        history,
        bibleRules: bibleRules,
        codexEntries: codexEntries,
        contextText: customContext || contextText,
        chapterId,
        provider,
        sessionMode,
        stream: true,
        onChunk: (chunk) => {
          currentReply += chunk;
          const streamMsg: ChatMessage = {
             id: assistantMsgId,
             role: 'model',
             content: currentReply,
             timestamp: Date.now()
          };
          const streamMessages = [...newMessages, streamMsg];
          setMessages(streamMessages);
          messagesRef.current = streamMessages;
        }
      });

      const assistantMsg: ChatMessage = { 
        id: assistantMsgId,
        role: 'model', 
        content: currentReply || reply, 
        timestamp: Date.now() 
      };
      
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      messagesRef.current = finalMessages; // Update ref to latest state
      onMessageAdded?.(finalMessages);
      onResponseReceived?.(reply);
      
      return reply;
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage = err.message || 'Maaf, terjadi kesalahan pada layanan AI.';
      onError?.(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [
    projectId, 
    chapterId, 
    codexEntries, 
    bibleRules, 
    contextText, 
    provider, 
    onMessageAdded, 
    onResponseReceived, 
    onError
  ]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    onMessageAdded?.([]);
  }, [onMessageAdded]);

  return {
    messages,
    setMessages,
    isLoading,
    sendMessage,
    clearMessages
  };
}
