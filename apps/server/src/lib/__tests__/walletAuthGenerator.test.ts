/**
 * Tests for Wallet Authentication Generator
 * Tests Ed25519 signature generation for x402 Gas Gateway authentication
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, test, expect } from 'bun:test';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { WalletAuthGenerator, type AuthHeaders } from '../walletAuthGenerator';

describe('WalletAuthGenerator', () => {

  describe('generateAuthHeaders', () => {
    test('generates authentication headers with correct structure', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);

      expect(headers).toHaveProperty('X-WALLET');
      expect(headers).toHaveProperty('X-WALLET-NONCE');
      expect(headers).toHaveProperty('X-WALLET-SIGNATURE');
      expect(headers['X-WALLET']).toBe(testPublicKey);
    });

    test('generates unique nonces across multiple calls', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers1 = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      const headers2 = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      const headers3 = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);

      // All nonces should be unique
      const nonces = [headers1['X-WALLET-NONCE'], headers2['X-WALLET-NONCE'], headers3['X-WALLET-NONCE']];
      const uniqueNonces = new Set(nonces);
      expect(uniqueNonces.size).toBe(3);
    });

    test('generates valid UUIDv4 nonces', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      const nonce = headers['X-WALLET-NONCE'];

      // UUIDv4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(nonce).toMatch(uuidV4Regex);
    });

    test('generates valid base58-encoded signatures', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      const signature = headers['X-WALLET-SIGNATURE'];

      // Should be valid base58
      expect(() => bs58.decode(signature)).not.toThrow();
      
      // Decoded signature should be 64 bytes (Ed25519 signature length)
      const decodedSignature = bs58.decode(signature);
      expect(decodedSignature.length).toBe(64);
    });

    test('signature can be verified with public key', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      const signature = headers['X-WALLET-SIGNATURE'];
      const nonce = headers['X-WALLET-NONCE'];

      // Reconstruct the message that was signed
      const message = `x402-wallet-claim:${path}:${nonce}`;
      const messageBytes = new TextEncoder().encode(message);

      // Decode signature from base58
      const signatureBytes = bs58.decode(signature);

      // Verify signature using nacl
      const publicKeyBytes = testKeypair.publicKey.toBytes();
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      expect(isValid).toBe(true);
    });

    test('message format is correct: x402-wallet-claim:{path}:{nonce}', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/transactions/sponsor';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      const signature = headers['X-WALLET-SIGNATURE'];
      const nonce = headers['X-WALLET-NONCE'];

      // Reconstruct expected message
      const expectedMessage = `x402-wallet-claim:${path}:${nonce}`;
      const messageBytes = new TextEncoder().encode(expectedMessage);

      // Verify signature matches expected message
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = testKeypair.publicKey.toBytes();
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      expect(isValid).toBe(true);
    });

    test('throws error when grid session missing address', async () => {
      const generator = new WalletAuthGenerator();
      const path = '/balance';
      const gridSession = {};
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(Keypair.generate().secretKey)
        }
      };

      await expect(
        generator.generateAuthHeaders(path, gridSession, gridSessionSecrets)
      ).rejects.toThrow('Grid session must contain wallet address');
    });

    test('throws error when private key cannot be extracted', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = {};

      await expect(
        generator.generateAuthHeaders(path, gridSession, gridSessionSecrets)
      ).rejects.toThrow('Could not extract private key from Grid session secrets');
    });

    test('handles different private key formats in session secrets', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { address: testPublicKey };

      // Test with secretKey directly
      const secrets1 = { secretKey: Array.from(testKeypair.secretKey) };
      const headers1 = await generator.generateAuthHeaders(path, gridSession, secrets1);
      expect(headers1['X-WALLET']).toBe(testPublicKey);

      // Test with privateKey directly
      const secrets2 = { privateKey: Array.from(testKeypair.secretKey) };
      const headers2 = await generator.generateAuthHeaders(path, gridSession, secrets2);
      expect(headers2['X-WALLET']).toBe(testPublicKey);

      // Test with keypair.secretKey
      const secrets3 = { keypair: { secretKey: Array.from(testKeypair.secretKey) } };
      const headers3 = await generator.generateAuthHeaders(path, gridSession, secrets3);
      expect(headers3['X-WALLET']).toBe(testPublicKey);

      // Test with keypair.privateKey
      const secrets4 = { keypair: { privateKey: Array.from(testKeypair.secretKey) } };
      const headers4 = await generator.generateAuthHeaders(path, gridSession, secrets4);
      expect(headers4['X-WALLET']).toBe(testPublicKey);

      // Test with keypair as array
      const secrets5 = { keypair: Array.from(testKeypair.secretKey) };
      const headers5 = await generator.generateAuthHeaders(path, gridSession, secrets5);
      expect(headers5['X-WALLET']).toBe(testPublicKey);
    });

    test('handles 32-byte seed (derives full keypair)', async () => {
      const generator = new WalletAuthGenerator();
      const path = '/balance';
      const seedKeypair = Keypair.generate();
      const seed = seedKeypair.secretKey.slice(0, 32); // First 32 bytes are the seed
      const gridSession = { address: seedKeypair.publicKey.toBase58() };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(seed)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      expect(headers['X-WALLET']).toBe(seedKeypair.publicKey.toBase58());

      // Verify signature
      const signature = headers['X-WALLET-SIGNATURE'];
      const nonce = headers['X-WALLET-NONCE'];
      const message = `x402-wallet-claim:${path}:${nonce}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = seedKeypair.publicKey.toBytes();
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      expect(isValid).toBe(true);
    });

    test('handles base58-encoded private key in session secrets', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const secretKeyBase58 = bs58.encode(testKeypair.secretKey);
      const gridSession = { address: testPublicKey };
      const gridSessionSecrets = { 
        secretKey: secretKeyBase58
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      expect(headers['X-WALLET']).toBe(testPublicKey);

      // Verify signature
      const signature = headers['X-WALLET-SIGNATURE'];
      const nonce = headers['X-WALLET-NONCE'];
      const message = `x402-wallet-claim:${path}:${nonce}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = testKeypair.publicKey.toBytes();
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      expect(isValid).toBe(true);
    });

    test('handles grid session with authentication.address', async () => {
      const generator = new WalletAuthGenerator();
      const testKeypair = Keypair.generate();
      const testPublicKey = testKeypair.publicKey.toBase58();
      const path = '/balance';
      const gridSession = { authentication: { address: testPublicKey } };
      const gridSessionSecrets = { 
        keypair: {
          secretKey: Array.from(testKeypair.secretKey)
        }
      };

      const headers = await generator.generateAuthHeaders(path, gridSession, gridSessionSecrets);
      expect(headers['X-WALLET']).toBe(testPublicKey);
    });
  });
});

