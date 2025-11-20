/**
 * Telemetry and Event Logging (Client)
 * 
 * Logs structured events for observability and analytics.
 * Events include metadata: wallet (hashed), environment, errorCode, timestamp.
 * 
 * Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.12
 */

import { config } from './config';

/**
 * Hash wallet address for privacy
 * 
 * @param wallet - Wallet address (base58)
 * @returns Hashed wallet address (first 8 chars for identification)
 */
async function hashWallet(wallet: string): Promise<string> {
  if (!wallet) return 'unknown';
  
  try {
    // Use Web Crypto API if available (browser/React Native with polyfill)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(wallet);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 8);
    } else {
      // Fallback: simple hash function for environments without Web Crypto
      let hash = 0;
      for (let i = 0; i < wallet.length; i++) {
        const char = wallet.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16).substring(0, 8);
    }
  } catch (error) {
    console.error('Failed to hash wallet:', error);
    return 'unknown';
  }
}

/**
 * Telemetry event metadata
 */
export interface TelemetryMetadata {
  wallet?: string; // Wallet address (will be hashed)
  environment?: string; // dev/staging/prod
  errorCode?: number; // HTTP status code for errors
  amount?: number; // Transaction amount (base units)
  required?: number; // Required amount (base units)
  available?: number; // Available amount (base units)
  billedAmount?: number; // Billed amount (base units)
  [key: string]: any; // Additional metadata
}

/**
 * Log a telemetry event
 * 
 * @param eventName - Event name (e.g., 'gas_topup_start')
 * @param metadata - Event metadata
 */
export async function logEvent(eventName: string, metadata: TelemetryMetadata = {}): Promise<void> {
  const timestamp = new Date().toISOString();
  const environment = config.isDevelopment ? 'development' : 'production';
  
  // Hash wallet if provided
  const hashedWallet = metadata.wallet ? await hashWallet(metadata.wallet) : undefined;
  
  // Build event object
  const event = {
    event: eventName,
    timestamp,
    environment,
    ...(hashedWallet && { wallet: hashedWallet }),
    ...(metadata.errorCode !== undefined && { errorCode: metadata.errorCode }),
    ...(metadata.amount !== undefined && { amount: metadata.amount }),
    ...(metadata.required !== undefined && { required: metadata.required }),
    ...(metadata.available !== undefined && { available: metadata.available }),
    ...(metadata.billedAmount !== undefined && { billedAmount: metadata.billedAmount }),
    // Include any additional metadata
    ...Object.fromEntries(
      Object.entries(metadata).filter(([key]) => 
        !['wallet', 'environment', 'errorCode', 'amount', 'required', 'available', 'billedAmount'].includes(key)
      )
    ),
  };

  // Log to console (can be extended to send to analytics service)
  console.log(`📊 [Telemetry] ${eventName}`, JSON.stringify(event, null, 2));
  
  // TODO: Integrate with analytics service (e.g., PostHog, Mixpanel, Vercel Analytics, etc.)
  // Example:
  // if (analyticsService) {
  //   analyticsService.track(eventName, event);
  // }
}

/**
 * Gas abstraction specific event logging functions
 */
export const gasTelemetry = {
  /**
   * Log top-up start
   */
  async topupStart(wallet: string): Promise<void> {
    await logEvent('gas_topup_start', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
    });
  },

  /**
   * Log top-up success
   */
  async topupSuccess(wallet: string, amount: number): Promise<void> {
    await logEvent('gas_topup_success', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
      amount,
    });
  },

  /**
   * Log top-up failure
   */
  async topupFailure(wallet: string, errorCode: number): Promise<void> {
    await logEvent('gas_topup_failure', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
      errorCode,
    });
  },

  /**
   * Log sponsorship start
   */
  async sponsorStart(wallet: string): Promise<void> {
    await logEvent('gas_sponsor_start', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
    });
  },

  /**
   * Log sponsorship success
   */
  async sponsorSuccess(wallet: string, billedAmount: number): Promise<void> {
    await logEvent('gas_sponsor_success', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
      billedAmount,
    });
  },

  /**
   * Log insufficient balance error
   */
  async sponsorInsufficientBalance(wallet: string, required: number, available: number): Promise<void> {
    await logEvent('gas_sponsor_insufficient_balance', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
      required,
      available,
    });
  },

  /**
   * Log sponsorship error
   */
  async sponsorError(wallet: string, errorCode: number): Promise<void> {
    await logEvent('gas_sponsor_error', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
      errorCode,
    });
  },

  /**
   * Log fallback to SOL
   */
  async sponsorFallbackToSol(wallet: string): Promise<void> {
    await logEvent('gas_sponsor_fallback_to_sol', {
      wallet,
      environment: config.isDevelopment ? 'development' : 'production',
    });
  },
};

