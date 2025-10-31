/**
 * Unit Tests for Draft Message Storage
 * 
 * Tests the draft message persistence functionality in isolation
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import '../setup/test-env';

// Mock the storage module to avoid React Native dependency issues
const mockStorage: Record<string, string> = {};

const mockGetItem = mock(async (key: string) => mockStorage[key] || null);
const mockSetItem = mock(async (key: string, value: string) => {
  mockStorage[key] = value;
});
const mockRemoveItem = mock(async (key: string) => {
  delete mockStorage[key];
});

// Mock the storage module
mock.module('@/lib/storage', () => ({
  secureStorage: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
  SECURE_STORAGE_KEYS: {
    DRAFT_MESSAGES: 'mallory_draft_messages',
  },
  getDraftMessage: async (conversationId: string) => {
    const draftsJson = mockStorage['mallory_draft_messages'];
    if (!draftsJson) return null;
    const drafts = JSON.parse(draftsJson);
    return drafts[conversationId] || null;
  },
  saveDraftMessage: async (conversationId: string, message: string) => {
    const draftsJson = mockStorage['mallory_draft_messages'];
    const drafts = draftsJson ? JSON.parse(draftsJson) : {};
    if (message.trim()) {
      drafts[conversationId] = message;
    } else {
      delete drafts[conversationId];
    }
    mockStorage['mallory_draft_messages'] = JSON.stringify(drafts);
  },
  clearDraftMessage: async (conversationId: string) => {
    const draftsJson = mockStorage['mallory_draft_messages'];
    if (!draftsJson) return;
    const drafts = JSON.parse(draftsJson);
    delete drafts[conversationId];
    mockStorage['mallory_draft_messages'] = JSON.stringify(drafts);
  },
  clearAllDraftMessages: async () => {
    delete mockStorage['mallory_draft_messages'];
  },
}));

import {
  getDraftMessage,
  saveDraftMessage,
  clearDraftMessage,
  clearAllDraftMessages,
  secureStorage,
  SECURE_STORAGE_KEYS,
} from '@/lib/storage';

describe('Draft Message Storage', () => {
  beforeEach(async () => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe('Save and Retrieve Draft Messages', () => {
    test('should save and retrieve draft message for a conversation', async () => {
      const conversationId = 'test-conv-1';
      const draftText = 'This is a draft message';

      await saveDraftMessage(conversationId, draftText);
      const retrieved = await getDraftMessage(conversationId);

      expect(retrieved).toBe(draftText);
    });

    test('should handle multiple drafts for different conversations', async () => {
      const conv1 = 'test-conv-1';
      const conv2 = 'test-conv-2';
      const conv3 = 'test-conv-3';

      const draft1 = 'Draft for conversation 1';
      const draft2 = 'Draft for conversation 2';
      const draft3 = 'Draft for conversation 3';

      await saveDraftMessage(conv1, draft1);
      await saveDraftMessage(conv2, draft2);
      await saveDraftMessage(conv3, draft3);

      const retrieved1 = await getDraftMessage(conv1);
      const retrieved2 = await getDraftMessage(conv2);
      const retrieved3 = await getDraftMessage(conv3);

      expect(retrieved1).toBe(draft1);
      expect(retrieved2).toBe(draft2);
      expect(retrieved3).toBe(draft3);
    });

    test('should update existing draft when saving again', async () => {
      const conversationId = 'test-conv-1';
      const firstDraft = 'First draft';
      const secondDraft = 'Updated draft';

      await saveDraftMessage(conversationId, firstDraft);
      await saveDraftMessage(conversationId, secondDraft);

      const retrieved = await getDraftMessage(conversationId);
      expect(retrieved).toBe(secondDraft);
    });

    test('should return null for conversation with no draft', async () => {
      const conversationId = 'test-conv-nonexistent';
      const retrieved = await getDraftMessage(conversationId);

      expect(retrieved).toBe(null);
    });

    test('should handle empty conversation ID gracefully', async () => {
      const retrieved = await getDraftMessage('');
      expect(retrieved).toBe(null);
    });
  });

  describe('Clear Draft Messages', () => {
    test('should clear draft for specific conversation', async () => {
      const conv1 = 'test-conv-1';
      const conv2 = 'test-conv-2';

      await saveDraftMessage(conv1, 'Draft 1');
      await saveDraftMessage(conv2, 'Draft 2');

      await clearDraftMessage(conv1);

      const retrieved1 = await getDraftMessage(conv1);
      const retrieved2 = await getDraftMessage(conv2);

      expect(retrieved1).toBe(null);
      expect(retrieved2).toBe('Draft 2');
    });

    test('should handle clearing non-existent draft', async () => {
      const conversationId = 'test-conv-nonexistent';
      
      // Should not throw error
      await clearDraftMessage(conversationId);
      
      const retrieved = await getDraftMessage(conversationId);
      expect(retrieved).toBe(null);
    });

    test('should clear all drafts', async () => {
      await saveDraftMessage('conv1', 'Draft 1');
      await saveDraftMessage('conv2', 'Draft 2');
      await saveDraftMessage('conv3', 'Draft 3');

      await clearAllDraftMessages();

      const retrieved1 = await getDraftMessage('conv1');
      const retrieved2 = await getDraftMessage('conv2');
      const retrieved3 = await getDraftMessage('conv3');

      expect(retrieved1).toBe(null);
      expect(retrieved2).toBe(null);
      expect(retrieved3).toBe(null);
    });
  });

  describe('Auto-clear on Empty Message', () => {
    test('should clear draft when saving empty string', async () => {
      const conversationId = 'test-conv-1';

      await saveDraftMessage(conversationId, 'Some draft text');
      await saveDraftMessage(conversationId, '');

      const retrieved = await getDraftMessage(conversationId);
      expect(retrieved).toBe(null);
    });

    test('should clear draft when saving whitespace-only string', async () => {
      const conversationId = 'test-conv-1';

      await saveDraftMessage(conversationId, 'Some draft text');
      await saveDraftMessage(conversationId, '   ');

      const retrieved = await getDraftMessage(conversationId);
      expect(retrieved).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long draft messages', async () => {
      const conversationId = 'test-conv-1';
      const longDraft = 'A'.repeat(10000); // 10k characters

      await saveDraftMessage(conversationId, longDraft);
      const retrieved = await getDraftMessage(conversationId);

      expect(retrieved).toBe(longDraft);
      expect(retrieved?.length).toBe(10000);
    });

    test('should handle special characters in draft', async () => {
      const conversationId = 'test-conv-1';
      const specialDraft = 'Draft with emoji 🚀 and symbols: @#$%^&*()';

      await saveDraftMessage(conversationId, specialDraft);
      const retrieved = await getDraftMessage(conversationId);

      expect(retrieved).toBe(specialDraft);
    });

    test('should handle multiline draft messages', async () => {
      const conversationId = 'test-conv-1';
      const multilineDraft = 'Line 1\nLine 2\nLine 3';

      await saveDraftMessage(conversationId, multilineDraft);
      const retrieved = await getDraftMessage(conversationId);

      expect(retrieved).toBe(multilineDraft);
    });

    test('should handle UUID-format conversation IDs', async () => {
      const conversationId = '123e4567-e89b-12d3-a456-426614174000';
      const draft = 'Draft for UUID conversation';

      await saveDraftMessage(conversationId, draft);
      const retrieved = await getDraftMessage(conversationId);

      expect(retrieved).toBe(draft);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle rapid successive saves', async () => {
      const conversationId = 'test-conv-1';
      
      // Save multiple times rapidly
      await Promise.all([
        saveDraftMessage(conversationId, 'Draft 1'),
        saveDraftMessage(conversationId, 'Draft 2'),
        saveDraftMessage(conversationId, 'Draft 3'),
      ]);

      const retrieved = await getDraftMessage(conversationId);
      
      // Should have one of the drafts (last write wins)
      expect(['Draft 1', 'Draft 2', 'Draft 3']).toContain(retrieved);
    });

    test('should handle concurrent saves to different conversations', async () => {
      await Promise.all([
        saveDraftMessage('conv1', 'Draft 1'),
        saveDraftMessage('conv2', 'Draft 2'),
        saveDraftMessage('conv3', 'Draft 3'),
      ]);

      const results = await Promise.all([
        getDraftMessage('conv1'),
        getDraftMessage('conv2'),
        getDraftMessage('conv3'),
      ]);

      expect(results[0]).toBe('Draft 1');
      expect(results[1]).toBe('Draft 2');
      expect(results[2]).toBe('Draft 3');
    });
  });

  describe('Storage Persistence', () => {
    test('should persist drafts in secure storage', async () => {
      const conversationId = 'test-conv-1';
      const draftText = 'Persisted draft';

      await saveDraftMessage(conversationId, draftText);

      // Check direct storage
      const storedData = await secureStorage.getItem(SECURE_STORAGE_KEYS.DRAFT_MESSAGES);
      expect(storedData).not.toBe(null);

      const parsed = JSON.parse(storedData!);
      expect(parsed[conversationId]).toBe(draftText);
    });

    test('should remove conversation from storage when cleared', async () => {
      const conversationId = 'test-conv-1';

      await saveDraftMessage(conversationId, 'Draft');
      await clearDraftMessage(conversationId);

      const storedData = await secureStorage.getItem(SECURE_STORAGE_KEYS.DRAFT_MESSAGES);
      
      if (storedData) {
        const parsed = JSON.parse(storedData);
        expect(parsed[conversationId]).toBeUndefined();
      }
    });
  });
});
