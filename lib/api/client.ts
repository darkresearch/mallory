import Constants from 'expo-constants';
import { config } from '../config';

// Mobile-specific API configuration
const defaultHeaders = {
  'Content-Type': 'application/json',
};

/**
 * Generate API URL for different environments
 */
export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  if (__DEV__) {
    // In development, point to our api-server
    return `http://localhost:3001${path}`;
  }

  // In production, use environment variable
  const apiBaseUrl = config.backendApiUrl;
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
