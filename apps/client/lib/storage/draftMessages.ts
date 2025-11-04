/**
 * Draft Message Storage
 * Manages in-progress messages per conversation using secure storage
 */

import { storage, SECURE_STORAGE_KEYS } from './index';

// Type for the draft messages map
export type DraftMessagesMap = Record<string, string>;

/**
 * Get all draft messages from storage
 */
async function getAllDrafts(): Promise<DraftMessagesMap> {
  try {
    const draftsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.DRAFT_MESSAGES);
    if (!draftsJson) return {};
    
    return JSON.parse(draftsJson) as DraftMessagesMap;
  } catch (error) {
    console.error('Error loading draft messages:', error);
    return {};
  }
}

/**
 * Save all draft messages to storage
 */
async function saveAllDrafts(drafts: DraftMessagesMap): Promise<void> {
  try {
    await storage.persistent.setItem(SECURE_STORAGE_KEYS.DRAFT_MESSAGES, JSON.stringify(drafts));
  } catch (error) {
    console.error('Error saving draft messages:', error);
  }
}

/**
 * Get draft message for a specific conversation
 */
export async function getDraftMessage(conversationId: string): Promise<string | null> {
  if (!conversationId) return null;
  
  const drafts = await getAllDrafts();
  return drafts[conversationId] || null;
}

/**
 * Save draft message for a specific conversation
 */
export async function saveDraftMessage(conversationId: string, message: string): Promise<void> {
  if (!conversationId) return;
  
  const drafts = await getAllDrafts();
  
  if (message.trim()) {
    // Save the draft
    drafts[conversationId] = message;
  } else {
    // Clear the draft if message is empty
    delete drafts[conversationId];
  }
  
  await saveAllDrafts(drafts);
}

/**
 * Clear draft message for a specific conversation
 */
export async function clearDraftMessage(conversationId: string): Promise<void> {
  if (!conversationId) return;
  
  const drafts = await getAllDrafts();
  delete drafts[conversationId];
  await saveAllDrafts(drafts);
}

/**
 * Clear all draft messages
 */
export async function clearAllDraftMessages(): Promise<void> {
  try {
    await storage.persistent.removeItem(SECURE_STORAGE_KEYS.DRAFT_MESSAGES);
  } catch (error) {
    console.error('Error clearing all draft messages:', error);
  }
}
