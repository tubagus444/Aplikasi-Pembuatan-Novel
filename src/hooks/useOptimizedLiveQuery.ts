import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';

function fastStringify(val: any): string {
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
}

/**
 * A wrapper around useLiveQuery that prevents React re-renders by returning
 * the same reference if the serialized result hasn't changed.
 * This fixes "Over-Fetching & React Re-renders" issues with Dexie returning new arrays.
 */
export function useOptimizedLiveQuery<T>(querier: () => Promise<T> | T, deps?: any[]): T | undefined {
  const result = useLiveQuery(querier, deps);
  const ref = useRef<T | undefined>(undefined);
  
  // Only update the ref if the deep content actually changed
  if (fastStringify(result) !== fastStringify(ref.current)) {
    ref.current = result;
  }
  
  return ref.current;
}
