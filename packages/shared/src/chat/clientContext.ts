/**
 * Client Context Utilities
 * Shared between production and tests for chat requests
 */

export interface ClientContextOptions {
  viewportWidth?: number;
  getDeviceInfo?: () => string | Record<string, any> | undefined;
  getTimezone?: () => string;
  walletBalance?: {
    sol?: number;
    usdc?: number;
    totalUsd?: number;
  };
}

export interface ClientContext {
  timezone: string;
  currentTime: string;
  currentDate: string;
  viewportWidth?: number;
  device?: string | Record<string, any>;
  walletBalance?: {
    sol?: number;
    usdc?: number;
    totalUsd?: number;
  };
}

/**
 * Build client context for chat requests
 * 
 * Shared between production and tests to ensure consistent context structure.
 * 
 * TODO: Make device detection predictable for CI/CD
 * Consider environment variable like MALLORY_TEST_MODE to override
 * device info with consistent values in automated test environments.
 * 
 * @param options - Optional configuration for viewport width, device info, and timezone
 * @returns Client context object for chat API requests
 */
export function buildClientContext(options?: ClientContextOptions): ClientContext {
  const timezone = options?.getTimezone?.() || 
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
  
  const deviceInfo = options?.getDeviceInfo?.();
  
  const context: ClientContext = {
    timezone,
    currentTime: new Date().toISOString(),
    currentDate: new Date().toISOString(),
  };

  if (options?.viewportWidth) {
    context.viewportWidth = options.viewportWidth;
  }

  if (deviceInfo) {
    context.device = deviceInfo;
  }

  if (options?.walletBalance) {
    context.walletBalance = options.walletBalance;
  }

  return context;
}

