/**
 * Context Wrapper for Tests
 * 
 * Provides AuthProvider and GridProvider for testing components
 * that depend on these contexts
 */

import React, { ReactNode } from 'react';
import { AuthProvider } from '../../contexts/AuthContext';
import { GridProvider } from '../../contexts/GridContext';

interface WrapperProps {
  children: ReactNode;
}

/**
 * Wraps components with both Auth and Grid providers
 * Use this for components that need both contexts
 */
export function AllProviders({ children }: WrapperProps) {
  return (
    <AuthProvider>
      <GridProvider>
        {children}
      </GridProvider>
    </AuthProvider>
  );
}

/**
 * Wraps components with only Auth provider
 * Use this for components that only need AuthContext
 */
export function AuthProviderWrapper({ children }: WrapperProps) {
  return <AuthProvider>{children}</AuthProvider>;
}

/**
 * Wraps components with only Grid provider
 * Note: GridProvider requires AuthProvider, so this includes both
 */
export function GridProviderWrapper({ children }: WrapperProps) {
  return (
    <AuthProvider>
      <GridProvider>
        {children}
      </GridProvider>
    </AuthProvider>
  );
}

