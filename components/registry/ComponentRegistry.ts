import { ComponentType } from 'react';

/**
 * JSON Schema type for component prop validation
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: JSONSchema;
  [key: string]: any;
}

/**
 * Definition of a component that can be registered
 */
export interface ComponentDefinition {
  /** Unique name for the component */
  name: string;
  /** The React component */
  component: ComponentType<any>;
  /** JSON schema for prop validation */
  propsSchema: JSONSchema;
  /** All registry components are dynamic (LLM-controlled) */
  category: 'dynamic';
  /** Human-readable description */
  description?: string;
  /** Example props for documentation/testing */
  examples?: any[];
}

/**
 * Validation result for component props
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Component registry for managing dynamic UI components
 */
export class ComponentRegistry {
  private components = new Map<string, ComponentDefinition>();

  /**
   * Register a new component
   */
  register(definition: ComponentDefinition): void {
    if (this.components.has(definition.name)) {
      console.warn(`Component '${definition.name}' is already registered. Overwriting.`);
    }
    
    this.components.set(definition.name, definition);
    console.log(`✅ Registered component: ${definition.name} (${definition.category})`);
  }

  /**
   * Get a component definition by name
   */
  get(name: string): ComponentDefinition | undefined {
    return this.components.get(name);
  }

  /**
   * List all registered components (all are dynamic)
   */
  list(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  /**
   * Check if a component is registered
   */
  has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Validate props against a component's schema
   */
  validate(name: string, props: any): ValidationResult {
    const component = this.components.get(name);
    if (!component) {
      return {
        valid: false,
        errors: [`Component '${name}' not found in registry`]
      };
    }

    return this.validateAgainstSchema(props, component.propsSchema);
  }

  /**
   * Simple JSON Schema validation
   * Note: This is a basic implementation. For production, consider using a full JSON Schema library
   */
  private validateAgainstSchema(data: any, schema: JSONSchema): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check types for present fields
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (data[field] !== undefined) {
          const fieldErrors = this.validateFieldType(data[field], fieldSchema, field);
          errors.push(...fieldErrors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual field type
   */
  private validateFieldType(value: any, schema: any, fieldName: string): string[] {
    const errors: string[] = [];
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (schema.type && actualType !== schema.type) {
      errors.push(`Field '${fieldName}' expected type '${schema.type}', got '${actualType}'`);
    }

    return errors;
  }

  /**
   * Get registry statistics
   */
  getStats(): { total: number; dynamic: number } {
    const all = this.list();
    return {
      total: all.length,
      dynamic: all.length // All registry components are dynamic
    };
  }

  /**
   * Clear all registered components (useful for testing)
   */
  clear(): void {
    this.components.clear();
  }
}

// Create a singleton instance
export const componentRegistry = new ComponentRegistry();

/**
 * Helper function to register a component with less boilerplate
 */
export function registerComponent(definition: ComponentDefinition): void {
  componentRegistry.register(definition);
}

/**
 * Helper function to get a component safely
 */
export function getComponent(name: string): ComponentType<any> | null {
  const definition = componentRegistry.get(name);
  return definition ? definition.component : null;
}

/**
 * Helper function to validate component props
 */
export function validateComponentProps(name: string, props: any): ValidationResult {
  return componentRegistry.validate(name, props);
}
