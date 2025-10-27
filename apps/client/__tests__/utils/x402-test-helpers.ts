/**
 * X402 Test Helpers
 * Wrapper functions that create configured instances from shared package
 */

import { Keypair } from '@solana/web3.js';
import { X402PaymentService, EphemeralWalletManager } from '@darkresearch/mallory-shared';
import { gridTestClient } from '../setup/grid-test-client';

const SOLANA_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Create X402 Payment Service for tests
 * Uses shared package implementation with test configuration
 */
export function createTestX402Service(): X402PaymentService {
  return new X402PaymentService({
    solanaRpcUrl: SOLANA_RPC_URL,
    solanaCluster: 'mainnet-beta',
    usdcMint: USDC_MINT,
    ephemeralFundingUsdc: '0.01',
    ephemeralFundingSol: '0.001'
  });
}

/**
 * Create Grid sender for tests
 * Wraps gridTestClient to match GridTokenSender interface
 */
export function createTestGridSender() {
  return {
    sendTokens: gridTestClient.sendTokens.bind(gridTestClient)
  };
}

/**
 * Create Ephemeral Wallet Manager for tests
 */
export function createTestEphemeralWalletManager(): EphemeralWalletManager {
  return new EphemeralWalletManager(SOLANA_RPC_URL, createTestGridSender());
}

/**
 * Ephemeral Wallet Manager Test - Compatible API with old implementation
 * Provides static methods that match the old test API
 */
export class EphemeralWalletManagerTest {
  static create(): { keypair: Keypair; address: string } {
    const manager = createTestEphemeralWalletManager();
    return manager.create();
  }

  static async fund(
    ephemeralAddress: string,
    usdcAmount: string,
    solAmount: string
  ): Promise<{ usdcSignature: string; solSignature: string }> {
    const manager = createTestEphemeralWalletManager();
    return manager.fund(ephemeralAddress, usdcAmount, solAmount, USDC_MINT);
  }

  static async sweepAll(
    ephemeralKeypair: Keypair,
    gridWalletAddress: string,
    tokenMint?: string
  ): Promise<{ swept: { tokens: number; sol: number; rentRecovered: number } }> {
    const manager = createTestEphemeralWalletManager();
    return manager.sweepAll(ephemeralKeypair, gridWalletAddress, tokenMint);
  }
}

/**
 * Execute X402 payment (convenience function)
 */
export async function executeX402Payment(paymentReq: any, gridAddress: string): Promise<any> {
  const x402Service = createTestX402Service();
  const gridSender = createTestGridSender();
  
  return x402Service.payAndFetchData(paymentReq, gridAddress, gridSender);
}

