import { secureStorage, SECURE_STORAGE_KEYS } from '../storage';

/**
 * Auth token management utilities
 */
export const authTokens = {
  /**
   * Get stored auth token
   */
  async getToken(): Promise<string | null> {
    try {
      return await secureStorage.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  },

  /**
   * Store auth token
   */
  async setToken(token: string): Promise<void> {
    try {
      await secureStorage.setItem(SECURE_STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Error setting auth token:', error);
    }
  },

  /**
   * Remove auth token
   */
  async removeToken(): Promise<void> {
    try {
      await secureStorage.removeItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error removing auth token:', error);
    }
  },
};
