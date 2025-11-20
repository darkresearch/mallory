/**
 * Telemetry and Event Logging
 * 
 * Logs structured events for observability and analytics.
 * Events include metadata: wallet (hashed), environment, errorCode, timestamp.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12
 */

import { createHash } from 'crypto';

/**
 * Hash wallet address for privacy
 * 
 * @param wallet - Wallet address (base58)
 * @returns Hashed wallet address (first 8 chars for identification)
 */
function hashWallet(wallet: string): string {
  if (!wallet) return 'unknown';
  const hash = createHash('sha256').update(wallet).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Telemetry event metadata
 */
export interface TelemetryMetadata {
  wallet?: string; // Hashed wallet address
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
 * @param eventName - Event name (e.g., 'gas_balance_fetch_success')
 * @param metadata - Event metadata
 */
export function logEvent(eventName: string, metadata: TelemetryMetadata = {}): void {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  
  // Hash wallet if provided
  const hashedWallet = metadata.wallet ? hashWallet(metadata.wallet) : undefined;
  
  // Build event object
  const event = {
    event: eventName,
    timestamp,
    environment,
    ...(hashedWallet && { wallet: hashedWallet }),
    ...(metadata.errorCode && { errorCode: metadata.errorCode }),
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
  
  // TODO: Integrate with analytics service (e.g., PostHog, Mixpanel, etc.)
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
   * Log balance fetch success
   */
  balanceFetchSuccess(wallet: string): void {
    logEvent('gas_balance_fetch_success', {
      wallet,
      environment: process.env.NODE_ENV,
    });
  },

  /**
   * Log balance fetch error
   */
  balanceFetchError(wallet: string, errorCode: number): void {
    logEvent('gas_balance_fetch_error', {
      wallet,
      environment: process.env.NODE_ENV,
      errorCode,
    });
  },

  /**
   * Log top-up start
   */
  topupStart(wallet: string): void {
    logEvent('gas_topup_start', {
      wallet,
      environment: process.env.NODE_ENV,
    });
  },

  /**
   * Log top-up success
   */
  topupSuccess(wallet: string, amount: number): void {
    logEvent('gas_topup_success', {
      wallet,
      environment: process.env.NODE_ENV,
      amount,
    });
  },

  /**
   * Log top-up failure
   */
  topupFailure(wallet: string, errorCode: number): void {
    logEvent('gas_topup_failure', {
      wallet,
      environment: process.env.NODE_ENV,
      errorCode,
    });
  },

  /**
   * Log sponsorship start
   */
  sponsorStart(wallet: string): void {
    logEvent('gas_sponsor_start', {
      wallet,
      environment: process.env.NODE_ENV,
    });
  },

  /**
   * Log sponsorship success
   */
  sponsorSuccess(wallet: string, billedAmount: number): void {
    logEvent('gas_sponsor_success', {
      wallet,
      environment: process.env.NODE_ENV,
      billedAmount,
    });
  },

  /**
   * Log insufficient balance error
   */
  sponsorInsufficientBalance(wallet: string, required: number, available: number): void {
    logEvent('gas_sponsor_insufficient_balance', {
      wallet,
      environment: process.env.NODE_ENV,
      required,
      available,
    });
  },

  /**
   * Log sponsorship error
   */
  sponsorError(wallet: string, errorCode: number): void {
    logEvent('gas_sponsor_error', {
      wallet,
      environment: process.env.NODE_ENV,
      errorCode,
    });
  },

  /**
   * Log fallback to SOL
   */
  sponsorFallbackToSol(wallet: string): void {
    logEvent('gas_sponsor_fallback_to_sol', {
      wallet,
      environment: process.env.NODE_ENV,
    });
  },
};

