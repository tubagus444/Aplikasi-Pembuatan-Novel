import { db } from '../db';
import { AppError } from '../types';

export const ErrorService = {
  async log(error: Partial<AppError>) {
    const appError: AppError = {
      message: error.message || 'Unknown error',
      timestamp: Date.now(),
      type: error.type || 'error',
      stack: error.stack || new Error().stack,
      source: error.source || 'Unknown',
      metadata: error.metadata
    };

    try {
      await db.errors.add(appError);
      console.error(`[AppError] ${appError.message}`, appError);
    } catch (e) {
      // Fallback if DB fails
      console.error('Failed to log error to DB:', e);
      console.error('Original error:', appError);
    }
  },

  async clearAll() {
    await db.errors.clear();
  },

  async getRecent(limit = 100) {
    return await db.errors.orderBy('timestamp').reverse().limit(limit).toArray();
  }
};
