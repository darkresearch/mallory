/**
 * Gas Abstraction Utilities
 * 
 * Helper functions for checking gas abstraction feature availability
 * and handling feature flag logic.
 * 
 * Requirements: 1.5, 1.6, 8.2
 */

import { FEATURES } from './config';

/**
 * Check if gas abstraction is enabled
 * 
 * @returns true if gas abstraction features should be available
 */
export function isGasAbstractionEnabled(): boolean {
  return FEATURES.GAS_ABSTRACTION_ENABLED;
}

/**
 * Check if gas abstraction should be enabled by default for new users
 * 
 * @returns true if gasless mode should be enabled by default
 */
export function isGasAbstractionDefaultEnabled(): boolean {
  return FEATURES.GAS_ABSTRACTION_DEFAULT_ENABLED;
}

/**
 * Get low balance threshold in USDC
 * 
 * @returns Threshold value in USDC
 */
export function getLowBalanceThreshold(): number {
  return FEATURES.GAS_ABSTRACTION_LOW_BALANCE_THRESHOLD;
}

/**
 * Get suggested top-up amount in USDC
 * 
 * @returns Suggested amount in USDC
 */
export function getSuggestedTopupAmount(): number {
  return FEATURES.GAS_ABSTRACTION_SUGGESTED_TOPUP;
}

/**
 * Get minimum top-up amount in USDC
 * 
 * @returns Minimum amount in USDC
 */
export function getMinTopupAmount(): number {
  return FEATURES.GAS_ABSTRACTION_MIN_TOPUP;
}

/**
 * Get maximum top-up amount in USDC
 * 
 * @returns Maximum amount in USDC
 */
export function getMaxTopupAmount(): number {
  return FEATURES.GAS_ABSTRACTION_MAX_TOPUP;
}

/**
 * Validate top-up amount is within bounds
 * 
 * @param amount - Amount in USDC to validate
 * @returns true if amount is valid, false otherwise
 */
export function validateTopupAmount(amount: number): boolean {
  return amount >= getMinTopupAmount() && amount <= getMaxTopupAmount();
}

