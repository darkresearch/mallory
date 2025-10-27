/**
 * Test Storage Mock
 * 
 * Replaces expo-secure-store for Node.js/Bun test environment
 * Stores data in `.test-secrets/test-storage.json`
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORAGE_DIR = join(process.cwd(), '.test-secrets');
const STORAGE_FILE = join(STORAGE_DIR, 'test-storage.json');

// Ensure storage directory exists
if (!existsSync(STORAGE_DIR)) {
  mkdirSync(STORAGE_DIR, { recursive: true });
}

// In-memory cache for fast access
let storageCache: Record<string, string> = {};

// Load existing storage on init
function loadStorage(): Record<string, string> {
  if (existsSync(STORAGE_FILE)) {
    try {
      const data = readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading storage:', error);
      return {};
    }
  }
  return {};
}

// Save storage to disk
function saveStorage(data: Record<string, string>): void {
  try {
    writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving storage:', error);
  }
}

// Initialize cache
storageCache = loadStorage();

/**
 * Test storage with same API as expo-secure-store
 */
export const testStorage = {
  async setItem(key: string, value: string): Promise<void> {
    storageCache[key] = value;
    saveStorage(storageCache);
  },

  async getItem(key: string): Promise<string | null> {
    return storageCache[key] || null;
  },

  async removeItem(key: string): Promise<void> {
    delete storageCache[key];
    saveStorage(storageCache);
  },

  async getAllKeys(): Promise<string[]> {
    return Object.keys(storageCache);
  },

  // Clear all storage (for cleanup)
  async clear(): Promise<void> {
    storageCache = {};
    saveStorage(storageCache);
  },
};

