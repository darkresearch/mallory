import { secureStorage } from '../storage';

const AUTH_TOKEN_KEY = 'scout_auth_token';

/**
 * Auth token management utilities
 */
export const authTokens = {
  /**
   * Get stored auth token
   */
  async getToken(): Promise<string | null> {
    try {
      return await secureStorage.getItem(AUTH_TOKEN_KEY);
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
      await secureStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting auth token:', error);
    }
  },

  /**
   * Remove auth token
   */
  async removeToken(): Promise<void> {
    try {
      await secureStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error removing auth token:', error);
    }
  },
};
