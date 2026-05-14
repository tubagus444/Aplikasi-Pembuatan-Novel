export type AIErrorCode = 
  | 'INVALID_KEY'
  | 'RATE_LIMIT' 
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'API_ERROR';

export function classifyError(status: number, message: string): AIErrorCode {
  const msg = message.toLowerCase();
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) {
    return msg.includes('quota') ? 'QUOTA_EXCEEDED' : 'RATE_LIMIT';
  }
  if (status === 404) return 'MODEL_NOT_FOUND';
  if (msg.includes('network') || msg.includes('fetch')) return 'NETWORK_ERROR';
  return 'API_ERROR';
}

export function getErrorMessage(code: AIErrorCode, provider: string): string {
  const p = provider.toUpperCase();
  const messages: Record<AIErrorCode, string> = {
    INVALID_KEY: `[${p}] API key invalid or expired. Check Settings.`,
    RATE_LIMIT: `[${p}] Rate limit hit. Wait a moment before retrying.`,
    QUOTA_EXCEEDED: `[${p}] Monthly quota exceeded. Check your billing.`,
    MODEL_NOT_FOUND: `[${p}] Model not found. Update model name in Settings.`,
    NETWORK_ERROR: `Network error. Check your connection.`,
    API_ERROR: `[${p}] Unexpected error. See Error Log for details.`,
  };
  return messages[code];
}
