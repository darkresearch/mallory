import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage, SECURE_STORAGE_KEYS } from '../lib/storage';

interface ActiveConversationContextType {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
}

const ActiveConversationContext = createContext<ActiveConversationContextType>({
  conversationId: null,
  setConversationId: () => {},
});

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
    console.log('🔧 [ActiveConversationProvider] Initializing, loading from storage...');
    storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID)
      .then((id) => {
        console.log('✅ [ActiveConversationProvider] Loaded from storage:', id);
        setConversationId(id);
      })
      .catch((error) => {
        console.error('❌ [ActiveConversationProvider] Error loading from storage:', error);
      });
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

