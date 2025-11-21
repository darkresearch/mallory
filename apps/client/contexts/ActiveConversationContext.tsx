import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage, SECURE_STORAGE_KEYS, SESSION_STORAGE_KEYS } from '@/lib/storage';

interface ActiveConversationContextType {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
}

const ActiveConversationContext = createContext<ActiveConversationContextType | undefined>(undefined);

export function useActiveConversationContext() {
  const context = useContext(ActiveConversationContext);
  if (!context) {
    throw new Error('useActiveConversationContext must be used within ActiveConversationProvider');
  }
  return context;
}

interface ActiveConversationProviderProps {
  children: ReactNode;
}

export function ActiveConversationProvider({ children }: ActiveConversationProviderProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Sync with storage on mount
  useEffect(() => {
    const initializeConversationId = async () => {
      console.log('🔧 [ActiveConversationProvider] Initializing, checking logout state...');
      
      // SECURITY FIX: Check for explicit logout before loading conversation ID
      const isLoggingOut = await storage.session.getItem(SESSION_STORAGE_KEYS.IS_LOGGING_OUT) === 'true';
      
      if (isLoggingOut) {
        console.log('🔒 [ActiveConversationProvider] Explicit logout detected, clearing conversation ID');
        setConversationId(null);
        
        try {
          await storage.persistent.removeItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
          console.log('🔒 [ActiveConversationProvider] Conversation ID cleared from persistent storage on logout');
        } catch (error) {
          console.error('🔒 [ActiveConversationProvider] Error clearing conversation ID (non-critical):', error);
        }
        
        // Clear the logout flag now that we've handled it
        await storage.session.removeItem(SESSION_STORAGE_KEYS.IS_LOGGING_OUT);
        console.log('🔒 [ActiveConversationProvider] Cleared logout flag');
      } else {
        console.log('🔧 [ActiveConversationProvider] Loading from storage...');
        try {
          const id = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
          console.log('✅ [ActiveConversationProvider] Loaded from storage:', id);
          setConversationId((prevId) => prevId || id);
        } catch (error) {
          console.error('❌ [ActiveConversationProvider] Error loading from storage:', error);
        }
      }
    };
    
    initializeConversationId();
  }, []);
  
  // Update storage when conversationId changes
  useEffect(() => {
    if (conversationId) {
      console.log('💾 [ActiveConversationProvider] Saving to storage:', conversationId);
      storage.persistent.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
    }
  }, [conversationId]);
  
  return (
    <ActiveConversationContext.Provider value={{ conversationId, setConversationId }}>
      {children}
    </ActiveConversationContext.Provider>
  );
}

