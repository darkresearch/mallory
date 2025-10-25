/**
 * Component Registry System
 * 
 * This module provides a centralized registry for managing dynamic UI components
 * that can be rendered based on LLM responses.
 */

export * from './ComponentRegistry';
export * from './ComponentDefinitions';

import { componentRegistry } from './ComponentRegistry';
import { allComponents } from './ComponentDefinitions';

/**
 * Initialize the component registry with all available components
 */
export function initializeComponentRegistry(): void {
  console.log('🚀 Initializing Dynamic UI Component Registry...');
  
  // Register all components
  allComponents.forEach(definition => {
    componentRegistry.register(definition);
  });

  // Log registry statistics
  const stats = componentRegistry.getStats();
  console.log(`📊 Registry initialized with ${stats.total} dynamic components`);
  
  // List all registered components for debugging
  if (__DEV__) {
    console.log('📋 Registered dynamic components:');
    const components = componentRegistry.list();
    
    components.forEach(comp => {
      console.log(`   - ${comp.name}: ${comp.description || 'No description'}`);
    });
  }
}

/**
 * Validate the registry setup (useful for debugging)
 */
export function validateRegistry(): boolean {
  const stats = componentRegistry.getStats();
  
  if (stats.total === 0) {
    console.error('❌ Component registry is empty!');
    return false;
  }

  if (stats.dynamic === 0) {
    console.warn('⚠️ No dynamic components registered');
  }

  console.log('✅ Component registry validation passed');
  return true;
}

// Auto-initialize in development
if (__DEV__) {
  initializeComponentRegistry();
}
