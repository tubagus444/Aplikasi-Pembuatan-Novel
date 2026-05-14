const MODEL_CACHE_KEY = 'openrouter_models_cache';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 jam

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const cached = localStorage.getItem(MODEL_CACHE_KEY);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) return data;
    } catch (e) {
      console.warn('Error parsing OpenRouter models cache', e);
    }
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    
    const json = await res.json();
    const models = json.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      pricing: m.pricing
    }));

    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify({
      data: models,
      timestamp: Date.now()
    }));

    return models;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    // Return empty or fallback if fetch fails but we have stale cache
    if (cached) {
      const { data } = JSON.parse(cached);
      return data;
    }
    return [];
  }
}
