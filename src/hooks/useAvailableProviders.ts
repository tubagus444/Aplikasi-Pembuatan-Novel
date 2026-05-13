import { useState, useEffect } from 'react';

const PROVIDERS = ['google', 'claude', 'groq', 'openrouter'];

export function useAvailableProviders() {
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);
  const [selectedProvider, setSelectedProvider] = useState<string>(() => 
    localStorage.getItem('ai_provider') || 'google'
  );

  useEffect(() => {
    const checkProviders = () => {
      const active = PROVIDERS.filter(p => {
        // For Google, we check if there's a system-level key or a user-provided key
        if (p === 'google' && process.env.GEMINI_API_KEY) return true;
        
        const key = localStorage.getItem(`ai_key_${p}`);
        return !!key;
      });
      
      const finalActive = active.length > 0 ? active : ['google'];
      setAvailableProviders(finalActive);
      
      // If current selected provider is not in the active list, fall back to the first available
      if (!finalActive.includes(selectedProvider)) {
        setSelectedProvider(finalActive[0]);
      }
    };

    checkProviders();
    
    // Listen for storage changes in case settings are updated in another tab/component
    window.addEventListener('storage', checkProviders);
    return () => window.removeEventListener('storage', checkProviders);
  }, [selectedProvider]);

  const updateSelectedProvider = (provider: string) => {
    setSelectedProvider(provider);
    localStorage.setItem('ai_provider', provider);
  };

  return {
    availableProviders,
    selectedProvider,
    setSelectedProvider: updateSelectedProvider
  };
}
