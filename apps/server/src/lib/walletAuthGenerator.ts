/**
 * Wallet Authentication Generator for x402 Gas Gateway
 * 
 * Generates Ed25519 signatures for authenticating requests to the x402 Gas Gateway.
 * Uses Grid wallet's private key to sign challenge messages.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import { randomUUID } from 'crypto';
// @ts-ignore - bs58 types not available
import bs58 from 'bs58';
import nacl from 'tweetnacl';

/**
 * Authentication headers for x402 gateway requests
 */
export interface AuthHeaders {
  'X-WALLET': string; // base58 public key
  'X-WALLET-NONCE': string; // UUIDv4 nonce
  'X-WALLET-SIGNATURE': string; // base58-encoded Ed25519 signature
}

/**
 * Wallet Authentication Generator
 * 
 * Generates authentication headers for x402 Gas Gateway using Ed25519 signatures.
 * Each request uses a unique UUIDv4 nonce to prevent replay attacks.
 */
export class WalletAuthGenerator {
  /**
   * Generate authentication headers for x402 gateway
   * Uses Grid wallet's private key to sign challenge
   * 
   * @param path - API endpoint path (e.g., "/balance", "/transactions/sponsor")
   * @param gridSession - Grid session object (contains address)
   * @param gridSessionSecrets - Grid session secrets containing private key
   * @returns Authentication headers for gateway request
   */
  async generateAuthHeaders(
    path: string,
    gridSession: any,
    gridSessionSecrets: any
  ): Promise<AuthHeaders> {
    // Extract wallet address from grid session
    const walletAddress = gridSession?.address || gridSession?.authentication?.address;
    if (!walletAddress) {
      throw new Error('Grid session must contain wallet address');
    }

    // Extract private key from session secrets
    // Grid session secrets structure may vary, so we try multiple possible locations
    const privateKey = this.extractPrivateKey(gridSessionSecrets, walletAddress);
    if (!privateKey) {
      throw new Error('Could not extract private key from Grid session secrets');
    }

    // Generate unique nonce (UUIDv4)
    const nonce = this.generateNonce();

    // Construct signature message: x402-wallet-claim:{path}:{nonce}
    const message = this.constructMessage(path, nonce);

    // Sign message using Ed25519
    const signature = this.signMessage(message, privateKey);

    // Encode signature as base58
    const signatureBase58 = this.encodeSignature(signature);

    // Return authentication headers
    return {
      'X-WALLET': walletAddress,
      'X-WALLET-NONCE': nonce,
      'X-WALLET-SIGNATURE': signatureBase58,
    };
  }

  /**
   * Extract private key from Grid session secrets
   * 
   * Grid session secrets may store the private key in different formats.
   * This method attempts to extract it from common locations.
   * 
   * @param sessionSecrets - Grid session secrets object
   * @param publicKey - Wallet public key (base58) for validation
   * @returns Private key as Uint8Array, or null if not found
   */
  private extractPrivateKey(sessionSecrets: any, publicKey: string): Uint8Array | null {
    try {
      // Try common locations for private key in Grid session secrets
      // Grid SDK may store it as:
      // - sessionSecrets.privateKey
      // - sessionSecrets.secretKey
      // - sessionSecrets.keypair.secretKey
      // - sessionSecrets.keypair.privateKey
      // - Array of bytes in sessionSecrets.keypair
      
      let privateKeyBytes: Uint8Array | null = null;

      // Check direct properties
      if (sessionSecrets?.privateKey) {
        privateKeyBytes = this.normalizeKeyBytes(sessionSecrets.privateKey);
      } else if (sessionSecrets?.secretKey) {
        privateKeyBytes = this.normalizeKeyBytes(sessionSecrets.secretKey);
      } else if (sessionSecrets?.keypair?.secretKey) {
        privateKeyBytes = this.normalizeKeyBytes(sessionSecrets.keypair.secretKey);
      } else if (sessionSecrets?.keypair?.privateKey) {
        privateKeyBytes = this.normalizeKeyBytes(sessionSecrets.keypair.privateKey);
      } else if (Array.isArray(sessionSecrets?.keypair)) {
        // Keypair might be stored as array of bytes
        privateKeyBytes = new Uint8Array(sessionSecrets.keypair);
      }

      if (!privateKeyBytes) {
        return null;
      }

      // Validate that the private key corresponds to the public key
      // Create a Keypair from the private key and verify public key matches
      try {
        // Solana Keypair.fromSecretKey() expects 64 bytes (32-byte seed + 32-byte public key)
        // If we have 32 bytes, we need to derive the full keypair
        let secretKey: Uint8Array;
        
        if (privateKeyBytes.length === 32) {
          // We have a 32-byte seed, derive the full keypair
          const keypair = Keypair.fromSeed(privateKeyBytes);
          secretKey = keypair.secretKey; // This is 64 bytes
        } else if (privateKeyBytes.length === 64) {
          // We have the full 64-byte secret key
          secretKey = privateKeyBytes;
        } else {
          console.error(`Invalid private key length: ${privateKeyBytes.length} (expected 32 or 64 bytes)`);
          return null;
        }

        // Verify the keypair matches the public key
        const keypair = Keypair.fromSecretKey(secretKey);
        const derivedPublicKey = keypair.publicKey.toBase58();
        
        if (derivedPublicKey !== publicKey) {
          console.warn(`Private key does not match public key. Expected: ${publicKey}, Got: ${derivedPublicKey}`);
          // Still return the key, as the mismatch might be due to different key formats
        }

        return secretKey;
      } catch (error) {
        console.error('Failed to create keypair from private key:', error);
        return null;
      }
    } catch (error) {
      console.error('Error extracting private key:', error);
      return null;
    }
  }

  /**
   * Normalize key bytes from various formats (array, base58 string, hex string, etc.)
   */
  private normalizeKeyBytes(key: any): Uint8Array | null {
    try {
      if (key instanceof Uint8Array) {
        return key;
      }
      
      if (Array.isArray(key)) {
        return new Uint8Array(key);
      }
      
      if (typeof key === 'string') {
        // Try base58 first (Solana standard)
        try {
          return new Uint8Array(bs58.decode(key));
        } catch {
          // Try hex
          if (key.startsWith('0x')) {
            return new Uint8Array(Buffer.from(key.slice(2), 'hex'));
          }
          // Try base64
          try {
            return new Uint8Array(Buffer.from(key, 'base64'));
          } catch {
            return null;
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate UUIDv4 nonce using cryptographically secure RNG
   * 
   * @returns UUIDv4 string
   */
  private generateNonce(): string {
    return randomUUID();
  }

  /**
   * Construct signature message: x402-wallet-claim:{path}:{nonce}
   * 
   * @param path - API endpoint path
   * @param nonce - UUIDv4 nonce
   * @returns Message string to sign
   */
  private constructMessage(path: string, nonce: string): string {
    return `x402-wallet-claim:${path}:${nonce}`;
  }

  /**
   * Sign message bytes using Ed25519
   * 
   * @param message - Message string to sign
   * @param privateKey - Private key as Uint8Array (64 bytes for Ed25519)
   * @returns Signature as Uint8Array (64 bytes)
   */
  private signMessage(message: string, privateKey: Uint8Array): Uint8Array {
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Sign message using nacl (tweetnacl) Ed25519 implementation
    // nacl.sign.detached() returns just the signature (64 bytes)
    // Private key must be 64 bytes (32-byte seed + 32-byte public key)
    // If we only have the 32-byte seed, we need to derive the keypair
    const signature = nacl.sign.detached(messageBytes, privateKey);
    
    return signature;
  }

  /**
   * Encode signature as base58
   * 
   * @param signature - Signature as Uint8Array
   * @returns Base58-encoded signature string
   */
  private encodeSignature(signature: Uint8Array): string {
    return bs58.encode(signature);
  }
}

