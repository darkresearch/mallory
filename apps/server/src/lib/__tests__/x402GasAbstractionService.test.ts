/**
 * Tests for X402 Gas Abstraction Service
 * Tests gateway API interactions, error handling, and data parsing
 * 
 * Requirements: 2.1, 2.2, 3.1, 4.1, 7.1, 7.2, 7.3, 7.4, 3.3, 3.4
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Keypair } from '@solana/web3.js';
import { X402GasAbstractionService, GatewayError, type X402GasAbstractionConfig, type GatewayBalance, type X402PaymentRequirement, type SponsorshipResult, type TopupResult } from '../x402GasAbstractionService';

describe('X402GasAbstractionService', () => {
  let service: X402GasAbstractionService;
  let config: X402GasAbstractionConfig;
  let testKeypair: Keypair;
  let testPublicKey: string;
  let gridSession: any;
  let gridSessionSecrets: any;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    config = {
      gatewayUrl: 'https://gateway.test',
      gatewayNetwork: 'solana-mainnet-beta',
      usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      solanaRpcUrl: 'https://api.mainnet-beta.solana.com'
    };
    service = new X402GasAbstractionService(config);
    
    testKeypair = Keypair.generate();
    testPublicKey = testKeypair.publicKey.toBase58();
    gridSession = { address: testPublicKey };
    gridSessionSecrets = {
      keypair: {
        secretKey: Array.from(testKeypair.secretKey)
      }
    };

    // Save original fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe('convertBaseUnitsToUsdc', () => {
    test('converts base units to USDC correctly', () => {
      expect(service.convertBaseUnitsToUsdc(1_000_000)).toBe(1.0);
      expect(service.convertBaseUnitsToUsdc(500_000)).toBe(0.5);
      expect(service.convertBaseUnitsToUsdc(100_000)).toBe(0.1);
      expect(service.convertBaseUnitsToUsdc(1)).toBe(0.000001);
    });
  });

  describe('convertUsdcToBaseUnits', () => {
    test('converts USDC to base units correctly', () => {
      expect(service.convertUsdcToBaseUnits(1.0)).toBe(1_000_000);
      expect(service.convertUsdcToBaseUnits(0.5)).toBe(500_000);
      expect(service.convertUsdcToBaseUnits(0.1)).toBe(100_000);
      expect(service.convertUsdcToBaseUnits(0.000001)).toBe(1);
    });
  });

  describe('validateNetworkAndAsset', () => {
    test('returns true when network and asset match', () => {
      const requirements: X402PaymentRequirement = {
        x402Version: 1,
        resource: 'topup',
        accepts: [],
        scheme: 'solana',
        network: 'solana-mainnet-beta',
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        maxAmountRequired: 100_000_000,
        payTo: 'test',
        description: 'test'
      };

      expect(service.validateNetworkAndAsset(requirements)).toBe(true);
    });

    test('returns false when network does not match', () => {
      const requirements: X402PaymentRequirement = {
        x402Version: 1,
        resource: 'topup',
        accepts: [],
        scheme: 'solana',
        network: 'solana-devnet',
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        maxAmountRequired: 100_000_000,
        payTo: 'test',
        description: 'test'
      };

      expect(service.validateNetworkAndAsset(requirements)).toBe(false);
    });

    test('returns false when asset does not match', () => {
      const requirements: X402PaymentRequirement = {
        x402Version: 1,
        resource: 'topup',
        accepts: [],
        scheme: 'solana',
        network: 'solana-mainnet-beta',
        asset: 'DifferentMintAddress',
        maxAmountRequired: 100_000_000,
        payTo: 'test',
        description: 'test'
      };

      expect(service.validateNetworkAndAsset(requirements)).toBe(false);
    });
  });

  describe('getBalance', () => {
    test('parses balance response correctly', async () => {
      const mockBalance: GatewayBalance = {
        wallet: testPublicKey,
        balanceBaseUnits: 5_000_000, // 5 USDC
        topups: [
          {
            paymentId: 'tx1',
            txSignature: 'tx1',
            amountBaseUnits: 5_000_000,
            timestamp: '2024-01-01T00:00:00Z'
          }
        ],
        usages: []
      };

      globalThis.fetch = mock(async (url: string | URL) => {
        expect(url.toString()).toContain('/balance');
        return new Response(JSON.stringify(mockBalance), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const result = await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);

      expect(result.wallet).toBe(testPublicKey);
      expect(result.balanceBaseUnits).toBe(5_000_000);
      expect(result.topups).toHaveLength(1);
      expect(result.usages).toHaveLength(0);
    });

    test('handles 402 Payment Required error with required and available amounts', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Insufficient balance',
          required: 10_000_000,
          available: 5_000_000
        }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      await expect(
        service.getBalance(testPublicKey, gridSession, gridSessionSecrets)
      ).rejects.toThrow(GatewayError);

      try {
        await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        if (error instanceof GatewayError) {
          expect(error.status).toBe(402);
          expect(error.data).toHaveProperty('required');
          expect(error.data).toHaveProperty('available');
        }
      }
    });

    test('handles 400 Bad Request error', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Invalid request',
          message: 'Transaction validation failed'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      await expect(
        service.getBalance(testPublicKey, gridSession, gridSessionSecrets)
      ).rejects.toThrow(GatewayError);

      try {
        await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        if (error instanceof GatewayError) {
          expect(error.status).toBe(400);
        }
      }
    });

    test('handles 401 Unauthorized with retry', async () => {
      let callCount = 0;
      globalThis.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          // First call returns 401
          return new Response(JSON.stringify({
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Retry succeeds
          return new Response(JSON.stringify({
            wallet: testPublicKey,
            balanceBaseUnits: 5_000_000,
            topups: [],
            usages: []
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }) as any;

      const result = await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);

      expect(callCount).toBe(2); // Should retry once
      expect(result.balanceBaseUnits).toBe(5_000_000);
    });

    test('handles 503 Service Unavailable error', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Service temporarily unavailable'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      await expect(
        service.getBalance(testPublicKey, gridSession, gridSessionSecrets)
      ).rejects.toThrow(GatewayError);

      try {
        await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        if (error instanceof GatewayError) {
          expect(error.status).toBe(503);
        }
      }
    });

    test('retries on transient 5xx errors', async () => {
      let callCount = 0;
      globalThis.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          // First call returns 500
          return new Response(JSON.stringify({
            error: 'Internal server error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Retry succeeds
          return new Response(JSON.stringify({
            wallet: testPublicKey,
            balanceBaseUnits: 5_000_000,
            topups: [],
            usages: []
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }) as any;

      const result = await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);

      expect(callCount).toBe(2); // Should retry once
      expect(result.balanceBaseUnits).toBe(5_000_000);
    });

    test('includes authentication headers in request', async () => {
      let capturedHeaders: any = null;
      globalThis.fetch = mock(async (url: string | URL, options?: RequestInit) => {
        capturedHeaders = options?.headers;
        return new Response(JSON.stringify({
          wallet: testPublicKey,
          balanceBaseUnits: 5_000_000,
          topups: [],
          usages: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      await service.getBalance(testPublicKey, gridSession, gridSessionSecrets);

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders['X-WALLET']).toBe(testPublicKey);
      expect(capturedHeaders['X-WALLET-NONCE']).toBeDefined();
      expect(capturedHeaders['X-WALLET-SIGNATURE']).toBeDefined();
    });
  });

  describe('getTopupRequirements', () => {
    test('parses top-up requirements correctly', async () => {
      const mockRequirements: X402PaymentRequirement = {
        x402Version: 1,
        resource: 'topup',
        accepts: [
          {
            scheme: 'solana',
            network: 'solana-mainnet-beta',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
          }
        ],
        scheme: 'solana',
        network: 'solana-mainnet-beta',
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        maxAmountRequired: 100_000_000,
        payTo: 'test-address',
        description: 'Gas credits top-up'
      };

      globalThis.fetch = mock(async (url: string | URL) => {
        expect(url.toString()).toContain('/topup/requirements');
        return new Response(JSON.stringify(mockRequirements), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const result = await service.getTopupRequirements();

      expect(result.x402Version).toBe(1);
      expect(result.network).toBe('solana-mainnet-beta');
      expect(result.asset).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(result.maxAmountRequired).toBe(100_000_000);
    });
  });

  describe('submitTopup', () => {
    test('submits top-up payment correctly', async () => {
      const mockResult: TopupResult = {
        wallet: testPublicKey,
        amountBaseUnits: 5_000_000,
        txSignature: 'test-signature',
        paymentId: 'test-signature'
      };

      let capturedHeaders: any = null;
      globalThis.fetch = mock(async (url: string | URL, options?: RequestInit) => {
        expect(url.toString()).toContain('/topup');
        capturedHeaders = options?.headers;
        return new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const payment = Buffer.from(JSON.stringify({ test: 'payment' })).toString('base64');
      const result = await service.submitTopup(payment);

      expect(result.wallet).toBe(testPublicKey);
      expect(result.amountBaseUnits).toBe(5_000_000);
      expect(result.txSignature).toBe('test-signature');
      expect(capturedHeaders['X-PAYMENT']).toBe(payment);
    });

    test('handles top-up errors', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Payment verification failed'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const payment = Buffer.from(JSON.stringify({ test: 'payment' })).toString('base64');
      
      await expect(
        service.submitTopup(payment)
      ).rejects.toThrow(GatewayError);
    });
  });

  describe('sponsorTransaction', () => {
    test('sponsors transaction correctly', async () => {
      const mockResult: SponsorshipResult = {
        transaction: 'base64-sponsored-tx',
        billedBaseUnits: 100_000, // 0.1 USDC
        fee: {
          amount: 100_000,
          amount_decimal: '0.1',
          currency: 'USDC'
        }
      };

      let capturedBody: any = null;
      globalThis.fetch = mock(async (url: string | URL, options?: RequestInit) => {
        expect(url.toString()).toContain('/transactions/sponsor');
        if (options?.body) {
          capturedBody = JSON.parse(options.body as string);
        }
        return new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const transaction = 'base64-unsigned-tx';
      const result = await service.sponsorTransaction(
        transaction,
        testPublicKey,
        gridSession,
        gridSessionSecrets
      );

      expect(result.transaction).toBe('base64-sponsored-tx');
      expect(result.billedBaseUnits).toBe(100_000);
      expect(capturedBody.transaction).toBe(transaction);
    });

    test('handles 402 insufficient balance error', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Insufficient balance',
          required: 10_000_000,
          available: 5_000_000
        }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const transaction = 'base64-unsigned-tx';
      
      await expect(
        service.sponsorTransaction(transaction, testPublicKey, gridSession, gridSessionSecrets)
      ).rejects.toThrow(GatewayError);

      try {
        await service.sponsorTransaction(transaction, testPublicKey, gridSession, gridSessionSecrets);
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        if (error instanceof GatewayError) {
          expect(error.status).toBe(402);
          expect(error.data).toHaveProperty('required');
          expect(error.data).toHaveProperty('available');
          expect(error.message).toContain('Insufficient');
        }
      }
    });

    test('handles 400 error for prohibited instructions', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Prohibited instruction: CloseAccount'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const transaction = 'base64-unsigned-tx';
      
      await expect(
        service.sponsorTransaction(transaction, testPublicKey, gridSession, gridSessionSecrets)
      ).rejects.toThrow(GatewayError);

      try {
        await service.sponsorTransaction(transaction, testPublicKey, gridSession, gridSessionSecrets);
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        if (error instanceof GatewayError) {
          expect(error.status).toBe(400);
          expect(error.message).toContain('not supported');
        }
      }
    });

    test('handles 400 error for old blockhash', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: 'Transaction blockhash is expired'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as any;

      const transaction = 'base64-unsigned-tx';
      
      await expect(
        service.sponsorTransaction(transaction, testPublicKey, gridSession, gridSessionSecrets)
      ).rejects.toThrow(GatewayError);

      try {
        await service.sponsorTransaction(transaction, testPublicKey, gridSession, gridSessionSecrets);
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        if (error instanceof GatewayError) {
          expect(error.status).toBe(400);
          expect(error.message).toContain('blockhash');
        }
      }
    });
  });
});

