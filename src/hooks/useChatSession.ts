import { useState, useCallback, useEffect } from 'react';
import { ChatMessage, CodexEntry, StoryBibleRule } from '../types';
import { processChat, cancelAI } from '../services/ai';
import { getRelevantContext, getRelevantBibleRules } from '../services/contextEngine';

interface UseChatSessionProps {
  projectId: number;
  chapterId?: number;
  codexEntries: CodexEntry[];
  bibleRules: StoryBibleRule[];
  contextText?: string;
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
  provider = 'google',
  initialMessages = [],
  onMessageAdded,
  onResponseReceived,
  onError
}: UseChatSessionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      cancelAI('chat');
    };
  }, []);

  const sendMessage = useCallback(async (text: string, customContext?: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { 
      id: Date.now().toString(),
      role: 'user', 
      content: text, 
      timestamp: Date.now() 
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    onMessageAdded?.(newMessages);
    setIsLoading(true);

    try {
      // 1. Gather relevant context
      const effectiveContext = customContext || contextText;
      const queryContext = effectiveContext + " " + text;
      
      const filteredCodex = await getRelevantContext(queryContext, codexEntries);
      const filteredBibleRules = await getRelevantBibleRules(queryContext, bibleRules);

      // 2. Prepare history for AI
      const history = newMessages
        .slice(-10) // Limit history to last 10 messages for performance
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      // 3. Process chat
      const reply = await processChat({
        message: text,
        history,
        bibleRules: filteredBibleRules,
        codexEntries: filteredCodex,
        contextText: effectiveContext,
        chapterId,
        provider
      });

      const assistantMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(),
        role: 'model', 
        content: reply, 
        timestamp: Date.now() 
      };
      
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
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
    }
  }, [
    messages, 
    isLoading, 
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
