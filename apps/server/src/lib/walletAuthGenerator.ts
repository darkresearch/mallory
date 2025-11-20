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

    // For x402 authentication, the gateway expects the public key of the signing keypair
    // Derive the public key from the private key to ensure it matches the signature
    const keypair = Keypair.fromSecretKey(privateKey);
    const signingPublicKey = keypair.publicKey.toBase58();

    // Return authentication headers
    // Use the signing public key for X-WALLET header (gateway verifies signature against this)
    // But also include wallet address in a separate header if needed
    return {
      'X-WALLET': signingPublicKey, // Use the public key of the signing keypair
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
  public extractPrivateKey(sessionSecrets: any, publicKey: string): Uint8Array | null {
    try {
      // Grid SDK stores session secrets as an array of provider entries
      // Each entry has: { publicKey, privateKey, provider, tag }
      // We need to find the "solana" provider entry
      
      // Debug: Log the structure we received
      console.log('🔍 [WalletAuth] Extracting private key. Session secrets type:', typeof sessionSecrets, 'isArray:', Array.isArray(sessionSecrets));
      if (Array.isArray(sessionSecrets)) {
        console.log('🔍 [WalletAuth] Session secrets array length:', sessionSecrets.length);
        sessionSecrets.forEach((entry: any, idx: number) => {
          console.log(`🔍 [WalletAuth] Entry ${idx}:`, {
            provider: entry?.provider,
            tag: entry?.tag,
            hasPrivateKey: !!entry?.privateKey,
            privateKeyType: typeof entry?.privateKey,
            privateKeyLength: entry?.privateKey?.length
          });
        });
      } else if (sessionSecrets) {
        console.log('🔍 [WalletAuth] Session secrets keys:', Object.keys(sessionSecrets));
      }
      
      let privateKeyBytes: Uint8Array | null = null;

      // Check if sessionSecrets is an array (Grid SDK format)
      if (Array.isArray(sessionSecrets)) {
        // Find the Solana provider entry
        const solanaEntry = sessionSecrets.find((entry: any) => 
          entry?.provider === 'solana' || entry?.tag === 'solana'
        );
        
        if (solanaEntry) {
          console.log('🔍 [WalletAuth] Found Solana entry:', {
            provider: solanaEntry.provider,
            tag: solanaEntry.tag,
            hasPrivateKey: !!solanaEntry.privateKey
          });
        } else {
          console.warn('🔍 [WalletAuth] No Solana entry found in session secrets array');
        }
        
        if (solanaEntry?.privateKey) {
          // Private key is stored as base64-encoded string in Grid format
          console.log('🔍 [WalletAuth] Attempting to normalize private key, type:', typeof solanaEntry.privateKey, 'length:', solanaEntry.privateKey.length);
          privateKeyBytes = this.normalizeKeyBytes(solanaEntry.privateKey);
          if (privateKeyBytes) {
            console.log('✅ [WalletAuth] Successfully normalized private key, length:', privateKeyBytes.length);
          } else {
            console.error('❌ [WalletAuth] Failed to normalize private key');
          }
        }
      }
      
      // Fallback: Try common locations for private key (legacy/test formats)
      if (!privateKeyBytes) {
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
      }

      if (!privateKeyBytes) {
        console.error('Could not find private key in session secrets. Structure:', {
          isArray: Array.isArray(sessionSecrets),
          keys: sessionSecrets ? Object.keys(sessionSecrets) : [],
          firstEntryKeys: Array.isArray(sessionSecrets) && sessionSecrets[0] ? Object.keys(sessionSecrets[0]) : []
        });
        return null;
      }

      // Validate that the private key is usable
      // Create a Keypair from the private key
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

        // Verify the keypair is valid (can create a keypair from it)
        const keypair = Keypair.fromSecretKey(secretKey);
        const derivedPublicKey = keypair.publicKey.toBase58();
        
        // For Grid wallets, the wallet address might not match the Solana keypair address
        // (Grid uses program-derived addresses). So we only warn, don't fail.
        if (derivedPublicKey !== publicKey) {
          console.warn(`Private key public key (${derivedPublicKey}) does not match wallet address (${publicKey}). This may be normal for Grid wallets.`);
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
   * Normalize key bytes from various formats (array, base58 string, hex string, base64, etc.)
   * Grid SDK stores keys as base64-encoded strings, so we try that first
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
        // Grid SDK stores keys as base64-encoded strings, try that first
        try {
          const base64Decoded = Buffer.from(key, 'base64');
          // If it's 32 or 64 bytes, it's likely a valid key
          if (base64Decoded.length === 32 || base64Decoded.length === 64) {
            return new Uint8Array(base64Decoded);
          }
        } catch {
          // Not base64, continue
        }
        
        // Try base58 (Solana standard)
        try {
          const base58Decoded = bs58.decode(key);
          if (base58Decoded.length === 32 || base58Decoded.length === 64) {
            return new Uint8Array(base58Decoded);
          }
        } catch {
          // Not base58, continue
        }
        
        // Try hex
        if (key.startsWith('0x')) {
          const hexDecoded = Buffer.from(key.slice(2), 'hex');
          if (hexDecoded.length === 32 || hexDecoded.length === 64) {
            return new Uint8Array(hexDecoded);
          }
        } else if (/^[0-9a-fA-F]+$/.test(key) && (key.length === 64 || key.length === 128)) {
          // Hex without 0x prefix (64 chars = 32 bytes, 128 chars = 64 bytes)
          const hexDecoded = Buffer.from(key, 'hex');
          if (hexDecoded.length === 32 || hexDecoded.length === 64) {
            return new Uint8Array(hexDecoded);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error normalizing key bytes:', error);
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

