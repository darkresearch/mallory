/**
 * Blockhash Helper Utility
 * 
 * Utilities for refreshing blockhashes in Solana transactions.
 * Used when gateway returns 400 error for expired blockhash.
 * 
 * Requirements: 4.18, 7.1
 * 
 * Note: Full transaction rebuild with fresh blockhash should be done client-side
 * where the original instructions are available. This utility provides helpers
 * for fetching fresh blockhashes.
 */

import { Connection } from '@solana/web3.js';

/**
 * Get fresh blockhash from Solana network
 * 
 * Used when rebuilding transactions with expired blockhashes.
 * The actual transaction rebuild should be done client-side where
 * the original instructions are available.
 * 
 * @param connection - Solana connection
 * @returns Fresh blockhash and last valid block height
 */
export async function getFreshBlockhash(
  connection: Connection
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = await connection.getLatestBlockhash('confirmed');
  
  console.log('🔄 [Blockhash] Fetched fresh blockhash:', {
    blockhash: result.blockhash.substring(0, 20) + '...',
    lastValidBlockHeight: result.lastValidBlockHeight
  });
  
  return result;
}

/**
 * Check if blockhash is expired
 * 
 * Note: This is a simplified check. In practice, blockhashes expire after ~150 blocks.
 * The gateway will return a 400 error if the blockhash is expired, which is the
 * authoritative signal.
 * 
 * @param blockhash - Blockhash to check
 * @param connection - Solana connection
 * @returns true if blockhash might be expired (heuristic), false otherwise
 */
export async function isBlockhashExpired(
  blockhash: string,
  connection: Connection
): Promise<boolean> {
  try {
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    
    // Blockhashes expire after ~150 blocks
    // If the blockhash doesn't match the latest, it might be expired
    // This is a heuristic - actual expiration depends on slot difference
    // The gateway's 400 error is the authoritative signal
    return blockhash !== latestBlockhash.blockhash;
  } catch (error) {
    // If we can't check, assume it might be expired
    console.warn('⚠️ [Blockhash] Could not verify blockhash expiration:', error);
    return true;
  }
}
