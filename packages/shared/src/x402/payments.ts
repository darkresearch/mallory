import { X402_CONSTANTS } from './constants';

/**
 * Payment approval logic
 * Shared between server and client
 */
export const PaymentUtils = {
  /**
   * Check if payment should be auto-approved
   */
  shouldAutoApprove(amount: string, currency: string): boolean {
    if (currency !== 'USDC') return false;
    const numAmount = parseFloat(amount);
    return numAmount < X402_CONSTANTS.AUTO_APPROVE_THRESHOLD_USDC;
  }
};

