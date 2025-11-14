import Constants from 'expo-constants';
import { config } from '../config';

// Mobile-specific API configuration
const defaultHeaders = {
  'Content-Type': 'application/json',
};

/**
 * Generate API URL for different environments
 * Uses config.backendApiUrl which already handles Android localhost -> 10.0.2.2 conversion
 */
export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  // Use config.backendApiUrl which handles platform-aware URL conversion
  const apiBaseUrl = config.backendApiUrl || (__DEV__ ? 'http://localhost:3001' : '');
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_BACKEND_API_URL configuration is not defined');
  }

  return `${apiBaseUrl}${path}`;
};

/**
 * Base API URL from environment
 */
const API_URL = config.backendApiUrl || '';

/**
 * Enhanced fetch wrapper for mobile-specific handling
 */
export async function mobileFetch(url: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response;
}
