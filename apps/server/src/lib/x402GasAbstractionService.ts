/**
 * x402 Gas Abstraction Service
 * 
 * Core service for interacting with the x402 Gas Abstraction Gateway.
 * Handles balance queries, top-ups, and transaction sponsorship.
 * 
 * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 4.11, 4.12
 */

import { WalletAuthGenerator, type AuthHeaders } from './walletAuthGenerator.js';
import type { GasAbstractionConfig } from './gasAbstractionConfig.js';

/**
 * Configuration for x402 Gas Abstraction Service
 */
export interface X402GasAbstractionConfig {
  gatewayUrl: string;
  gatewayNetwork: string;
  usdcMint: string;
  solanaRpcUrl: string;
}

/**
 * Gateway balance response
 */
export interface GatewayBalance {
  wallet: string; // base58 public key
  balanceBaseUnits: number; // USDC in base units (6 decimals)
  topups: TopupRecord[];
  usages: UsageRecord[];
}

/**
 * Top-up record from gateway
 */
export interface TopupRecord {
  paymentId: string; // Same as txSignature
  txSignature: string;
  amountBaseUnits: number;
  timestamp: string; // ISO 8601
}

/**
 * Usage record (sponsored transaction) from gateway
 */
export interface UsageRecord {
  txSignature: string;
  amountBaseUnits: number;
  status: 'pending' | 'settled' | 'failed';
  timestamp: string; // ISO 8601
  settled_at?: string; // ISO 8601
}

/**
 * x402 Payment requirement for top-up
 */
export interface X402PaymentRequirement {
  x402Version: number;
  resource?: string;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    payTo?: string;
    maxAmountRequired?: string | number;
    description?: string;
    resource?: string;
    extra?: {
      feePayer?: string;
      decimals?: number;
      recentBlockhash?: string;
    };
  }>;
  scheme: string;
  network: string;
  asset: string;
  maxAmountRequired: number;
  payTo: string;
  description?: string;
  extra?: {
    feePayer?: string;
    decimals?: number;
    recentBlockhash?: string;
  };
}

/**
 * Sponsorship result from gateway
 */
export interface SponsorshipResult {
  transaction: string; // base64 sponsored VersionedTransaction
  billedBaseUnits: number; // amount debited from balance
  fee?: {
    amount: number;
    amount_decimal: string;
    currency: string;
  };
}

/**
 * Top-up result from gateway
 */
export interface TopupResult {
  wallet: string; // base58 public key
  amountBaseUnits: number; // amount credited
  txSignature: string; // Solana transaction signature
  paymentId: string; // Same as txSignature
}

/**
 * x402 Payment payload for top-up submission
 */
export interface X402Payment {
  x402Version: number;
  scheme: string;
  network: string;
  asset: string;
  payload: {
    transaction: string; // base64-encoded signed USDC transfer
    publicKey: string; // base58 user public key
  };
}

/**
 * Custom error for gateway API errors
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/**
 * x402 Gas Abstraction Service
 * 
 * Provides methods for interacting with the x402 Gas Abstraction Gateway:
 * - Balance queries with authentication
 * - Top-up requirements and submission
 * - Transaction sponsorship
 */
export class X402GasAbstractionService {
  private config: X402GasAbstractionConfig;
  private walletAuthGenerator: WalletAuthGenerator;
  private readonly USDC_DECIMALS = 6; // USDC has 6 decimal places

  constructor(config: X402GasAbstractionConfig) {
    this.config = config;
    this.walletAuthGenerator = new WalletAuthGenerator();
  }

  /**
   * Convert base units to USDC amount
   * 
   * @param baseUnits - Amount in base units (smallest denomination)
   * @returns USDC amount with 6 decimal places
   */
  convertBaseUnitsToUsdc(baseUnits: number): number {
    return baseUnits / Math.pow(10, this.USDC_DECIMALS);
  }

  /**
   * Convert USDC amount to base units
   * 
   * @param usdc - USDC amount
   * @returns Amount in base units (smallest denomination)
   */
  convertUsdcToBaseUnits(usdc: number): number {
    return Math.round(usdc * Math.pow(10, this.USDC_DECIMALS));
  }

  /**
   * Validate network and asset match configuration
   * 
   * @param requirements - Payment requirements from gateway
   * @returns true if network and asset match, false otherwise
   */
  validateNetworkAndAsset(requirements: X402PaymentRequirement): boolean {
    const networkMatch = requirements.network === this.config.gatewayNetwork;
    const assetMatch = requirements.asset === this.config.usdcMint;
    
    if (!networkMatch || !assetMatch) {
      console.warn('Network/Asset validation mismatch:', {
        gatewayNetwork: requirements.network,
        expectedNetwork: this.config.gatewayNetwork,
        networkMatch,
        gatewayAsset: requirements.asset,
        expectedAsset: this.config.usdcMint,
        assetMatch
      });
    }
    
    return networkMatch && assetMatch;
  }

  /**
   * Make authenticated request to gateway
   * 
   * @param path - API endpoint path
   * @param method - HTTP method
   * @param body - Request body (optional)
   * @param gridSession - Grid session object
   * @param gridSessionSecrets - Grid session secrets
   * @param retryOn401 - Whether to retry once on 401 errors with fresh signature
   * @returns Response data
   * @throws GatewayError on API errors
   */
  private async makeAuthenticatedRequest<T>(
    path: string,
    method: string,
    body?: any,
    gridSession?: any,
    gridSessionSecrets?: any,
    retryOn401: boolean = true
  ): Promise<T> {
    const url = `${this.config.gatewayUrl}${path}`;
    
    // Generate authentication headers if session is provided
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (gridSession && gridSessionSecrets) {
      const authHeaders = await this.walletAuthGenerator.generateAuthHeaders(
        path,
        gridSession,
        gridSessionSecrets
      );
      headers = { ...headers, ...authHeaders };
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    requestOptions.signal = controller.signal;

    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Handle error responses with specific error parsing
      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        
        // Handle 401 Unauthorized - retry once with fresh signature
        if (response.status === 401 && retryOn401 && gridSession && gridSessionSecrets) {
          console.log('401 Unauthorized, retrying with fresh signature...');
          // Retry once with fresh signature (retryOn401 = false to prevent infinite loop)
          return await this.makeAuthenticatedRequest<T>(
            path,
            method,
            body,
            gridSession,
            gridSessionSecrets,
            false
          );
        }
        
        // Parse error message based on status code
        let errorMessage = errorData.error || errorData.message || `Gateway returned ${response.status}`;
        
        // For 402 Payment Required, extract required and available amounts
        if (response.status === 402) {
          console.log('❌ [Gateway] 402 Payment Required error data:', JSON.stringify(errorData, null, 2));
          errorMessage = this.parseInsufficientBalanceError(errorData);
        }
        
        // For 400 Bad Request, parse specific validation errors
        if (response.status === 400) {
          errorMessage = this.parseValidationError(errorData);
        }
        
        throw new GatewayError(
          errorMessage,
          response.status,
          errorData
        );
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof GatewayError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayError('Request timeout', 504);
      }
      
      throw new GatewayError(
        error instanceof Error ? error.message : 'Network error',
        500
      );
    }
  }

  /**
   * Parse insufficient balance error (402) to extract required and available amounts
   * 
   * @param errorData - Error response data
   * @returns Formatted error message
   */
  private parseInsufficientBalanceError(errorData: any): string {
    const required = errorData.required || errorData.requiredBaseUnits;
    const available = errorData.available || errorData.availableBaseUnits;
    
    if (required !== undefined && available !== undefined) {
      const requiredUsdc = this.convertBaseUnitsToUsdc(required);
      const availableUsdc = this.convertBaseUnitsToUsdc(available);
      return `Insufficient gas credits. Available: ${availableUsdc.toFixed(6)} USDC, Required: ${requiredUsdc.toFixed(6)} USDC`;
    }
    
    return errorData.error || errorData.message || 'Insufficient gas credits';
  }

  /**
   * Parse validation error (400) to extract specific error messages
   * 
   * @param errorData - Error response data
   * @returns Formatted error message
   */
  private parseValidationError(errorData: any): string {
    const errorMessage = errorData.error || errorData.message || 'Transaction validation failed';
    
    // Check for prohibited instructions
    if (errorMessage.toLowerCase().includes('prohibited instruction') ||
        errorMessage.toLowerCase().includes('closeaccount') ||
        errorMessage.toLowerCase().includes('setauthority')) {
      return 'This operation is not supported by gas sponsorship. Prohibited instructions: CloseAccount, SetAuthority';
    }
    
    // Check for old blockhash error
    if (errorMessage.toLowerCase().includes('blockhash') ||
        errorMessage.toLowerCase().includes('expired') ||
        errorMessage.toLowerCase().includes('stale')) {
      return 'Transaction blockhash is expired. Please rebuild transaction with fresh blockhash.';
    }
    
    return errorMessage;
  }

  /**
   * Get balance from gateway (with authentication)
   * 
   * @param gridWalletAddress - Grid wallet address (base58)
   * @param gridSession - Grid session object
   * @param gridSessionSecrets - Grid session secrets
   * @returns Balance data with topups and usages
   * @throws GatewayError on API errors
   */
  async getBalance(
    gridWalletAddress: string,
    gridSession: any,
    gridSessionSecrets: any
  ): Promise<GatewayBalance> {
    // Retry once for transient network errors
    try {
      return await this.makeAuthenticatedRequest<GatewayBalance>(
        '/balance',
        'GET',
        undefined,
        gridSession,
        gridSessionSecrets
      );
    } catch (error) {
      // Retry once for transient errors (5xx, network errors)
      if (
        error instanceof GatewayError &&
        (error.status >= 500 || error.status === 0)
      ) {
        console.log('Retrying balance request after transient error...');
        return await this.makeAuthenticatedRequest<GatewayBalance>(
          '/balance',
          'GET',
          undefined,
          gridSession,
          gridSessionSecrets
        );
      }
      throw error;
    }
  }

  /**
   * Get top-up requirements from gateway (no authentication required)
   * 
   * @returns Payment requirements
   * @throws GatewayError on API errors
   */
  async getTopupRequirements(): Promise<X402PaymentRequirement> {
    try {
      // Use makeRequest instead of makeAuthenticatedRequest since gateway doesn't require auth for this endpoint
      const requirements = await this.makeRequest<any>(
        '/topup/requirements',
        'GET'
      );
      
      // Log raw response for debugging
      console.log('📋 [Service] Raw gateway requirements:', JSON.stringify(requirements, null, 2));
      console.log('📋 [Service] Requirements keys:', Object.keys(requirements || {}));
      
      // Check if response is wrapped in a data field
      let actualRequirements = requirements;
      if (requirements.data && typeof requirements.data === 'object') {
        console.log('⚠️ [Service] Requirements wrapped in data field, unwrapping');
        actualRequirements = requirements.data;
      }
      
      // Extract fields from accepts array if they're not at top level
      // The gateway returns payTo, maxAmountRequired, description, etc. inside the accepts array
      if (actualRequirements.accepts && actualRequirements.accepts.length > 0) {
        const firstAccept = actualRequirements.accepts[0];
        
        // Extract network, asset, scheme from accepts array if missing at top level
        actualRequirements.network = actualRequirements.network || firstAccept.network;
        actualRequirements.asset = actualRequirements.asset || firstAccept.asset;
        actualRequirements.scheme = actualRequirements.scheme || firstAccept.scheme;
        
        // Extract payTo from accepts array (this is where the gateway puts it)
        if (!actualRequirements.payTo && firstAccept.payTo) {
          console.log('📋 [Service] Extracting payTo from accepts array');
          actualRequirements.payTo = firstAccept.payTo;
        }
        
        // Extract maxAmountRequired from accepts array (may be string, convert to number)
        if (!actualRequirements.maxAmountRequired && firstAccept.maxAmountRequired) {
          const maxAmount = typeof firstAccept.maxAmountRequired === 'string' 
            ? parseInt(firstAccept.maxAmountRequired, 10)
            : firstAccept.maxAmountRequired;
          actualRequirements.maxAmountRequired = maxAmount;
        }
        
        // Extract description from accepts array
        if (!actualRequirements.description && firstAccept.description) {
          actualRequirements.description = firstAccept.description;
        }
        
        // Extract resource from accepts array
        if (!actualRequirements.resource && firstAccept.resource) {
          actualRequirements.resource = firstAccept.resource;
        }
        
        // Extract extra fields (feePayer, decimals, recentBlockhash) if needed
        if (firstAccept.extra) {
          actualRequirements.extra = firstAccept.extra;
        }
      }
      
      // Check for alternative field names for payTo (fallback)
      if (!actualRequirements.payTo) {
        // Try alternative field names at top level
        const payTo = (actualRequirements as any).pay_to || 
                      (actualRequirements as any).paymentAddress || 
                      (actualRequirements as any).payment_address ||
                      (actualRequirements as any).payToAddress ||
                      (actualRequirements as any).payment_to ||
                      (actualRequirements as any).recipient ||
                      (actualRequirements as any).recipientAddress;
        
        if (payTo) {
          console.log('⚠️ [Service] Found payTo with alternative field name, normalizing to payTo');
          actualRequirements.payTo = payTo;
        } else {
          console.error('❌ [Service] payTo field missing and no alternatives found');
          console.error('   Available keys:', Object.keys(actualRequirements || {}));
          console.error('   Full response:', JSON.stringify(actualRequirements, null, 2));
          throw new GatewayError(
            'Gateway response missing required field: payTo',
            502,
            { receivedFields: Object.keys(actualRequirements || {}), fullResponse: actualRequirements }
          );
        }
      }
      
      // Ensure maxAmountRequired is a number
      if (actualRequirements.maxAmountRequired && typeof actualRequirements.maxAmountRequired === 'string') {
        actualRequirements.maxAmountRequired = parseInt(actualRequirements.maxAmountRequired, 10);
      }
      
      return actualRequirements as X402PaymentRequirement;
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }
      console.error('❌ [Service] Unexpected error in getTopupRequirements:', error);
      throw new GatewayError(
        error instanceof Error ? error.message : 'Failed to get top-up requirements',
        500
      );
    }
  }
  
  /**
   * Make unauthenticated request to gateway
   * Used for endpoints that don't require wallet authentication
   */
  private async makeRequest<T>(
    path: string,
    method: string,
    body?: any
  ): Promise<T> {
    const url = `${this.config.gatewayUrl}${path}`;
    
    console.log(`🌐 [Service] Making request to gateway: ${method} ${url}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    requestOptions.signal = controller.signal;

    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Get response text first to log it
      const responseText = await response.text();
      console.log(`📥 [Service] Gateway response (${response.status}):`, responseText.substring(0, 500));

      // Try to parse as JSON
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ [Service] Failed to parse gateway response as JSON:', responseText);
        throw new GatewayError(
          `Gateway returned invalid JSON: ${responseText.substring(0, 100)}`,
          response.status,
          { rawResponse: responseText }
        );
      }

      // Handle error responses
      if (!response.ok) {
        const errorMessage = responseData.error || responseData.message || `Gateway returned ${response.status}`;
        console.error(`❌ [Service] Gateway error (${response.status}):`, errorMessage);
        throw new GatewayError(
          errorMessage,
          response.status,
          responseData
        );
      }

      // Check if response has error field even with 200 status
      if (responseData.error) {
        console.error('❌ [Service] Gateway returned error in 200 response:', responseData.error);
        throw new GatewayError(
          responseData.error || responseData.message || 'Gateway returned an error',
          responseData.status || 500,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof GatewayError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayError('Request timeout', 504);
      }
      
      throw new GatewayError(
        error instanceof Error ? error.message : 'Network error',
        500
      );
    }
  }

  /**
   * Submit top-up payment to gateway
   * 
   * @param payment - x402 payment payload (base64-encoded string or X402Payment object)
   * @returns Top-up result
   * @throws GatewayError on API errors
   */
  async submitTopup(payment: X402Payment | string): Promise<TopupResult> {
    const url = `${this.config.gatewayUrl}/topup`;
    
    // If payment is already base64-encoded string, use it directly
    // Otherwise, encode the X402Payment object
    const paymentBase64 = typeof payment === 'string' 
      ? payment 
      : Buffer.from(JSON.stringify(payment)).toString('base64');
    
    // Log request details (decode and log payment structure for debugging)
    let paymentStructure: any = null;
    try {
      const decoded = Buffer.from(paymentBase64, 'base64').toString('utf-8');
      paymentStructure = JSON.parse(decoded);
      console.log('📤 [Service] Submitting top-up to gateway:', {
        url,
        paymentBase64Length: paymentBase64.length,
        paymentType: typeof payment,
        paymentStructure: {
          x402Version: paymentStructure.x402Version,
          scheme: paymentStructure.scheme,
          network: paymentStructure.network,
          asset: paymentStructure.asset,
          hasPayload: !!paymentStructure.payload,
          hasTransaction: !!paymentStructure.payload?.transaction,
          transactionLength: paymentStructure.payload?.transaction?.length,
          hasPublicKey: !!paymentStructure.payload?.publicKey,
          publicKey: paymentStructure.payload?.publicKey,
        },
      });
    } catch (e) {
      console.log('📤 [Service] Submitting top-up to gateway:', {
        url,
        paymentBase64Length: paymentBase64.length,
        paymentType: typeof payment,
        decodeError: e instanceof Error ? e.message : String(e),
      });
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': paymentBase64,
      },
    });

    // Get response text first to log it
    const responseText = await response.text();
    console.log(`📥 [Service] Gateway top-up response (${response.status}):`, responseText.substring(0, 500));

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ [Service] Failed to parse gateway error response as JSON:', responseText);
        errorData = { error: responseText, rawResponse: responseText };
      }
      
      let errorMessage = errorData.error || errorData.message || `Gateway returned ${response.status}`;
      
      if (response.status === 402) {
        console.log('❌ [Gateway] 402 Payment Required error data:', JSON.stringify(errorData, null, 2));
        
        // Decode and log the payment payload we sent for debugging
        try {
          const decodedPayment = Buffer.from(paymentBase64, 'base64').toString('utf-8');
          const paymentObj = JSON.parse(decodedPayment);
          console.log('🔍 [Gateway] Payment payload we sent:', {
            x402Version: paymentObj.x402Version,
            scheme: paymentObj.scheme,
            network: paymentObj.network,
            asset: paymentObj.asset,
            hasPayload: !!paymentObj.payload,
            hasTransaction: !!paymentObj.payload?.transaction,
            transactionLength: paymentObj.payload?.transaction?.length,
            hasPublicKey: !!paymentObj.payload?.publicKey,
            publicKey: paymentObj.payload?.publicKey,
            transactionPreview: paymentObj.payload?.transaction?.substring(0, 50) + '...',
          });
        } catch (e) {
          console.error('❌ [Gateway] Failed to decode payment payload for logging:', e);
        }
        
        // For 402, the gateway might return the requirements again (per spec)
        // Check if it's a requirements response
        if (errorData.accepts || errorData.payTo) {
          errorMessage = 'Payment missing or invalid. The gateway returned payment requirements. Please verify the transaction was signed correctly.';
        } else {
          errorMessage = this.parseInsufficientBalanceError(errorData);
        }
      } else if (response.status === 400) {
        console.log('❌ [Gateway] 400 Bad Request error data:', JSON.stringify(errorData, null, 2));
        errorMessage = this.parseValidationError(errorData);
      }
      
      throw new GatewayError(
        errorMessage,
        response.status,
        errorData
      );
    }

    // Parse successful response
    let result: TopupResult;
    try {
      result = JSON.parse(responseText) as TopupResult;
    } catch (parseError) {
      console.error('❌ [Service] Failed to parse gateway success response as JSON:', responseText);
      throw new GatewayError(
        'Gateway returned invalid JSON response',
        502,
        { rawResponse: responseText }
      );
    }

    console.log('✅ [Service] Top-up successful:', {
      wallet: result.wallet?.substring(0, 20) + '...',
      amountBaseUnits: result.amountBaseUnits,
      txSignature: result.txSignature?.substring(0, 20) + '...',
    });

    return result;
  }

  /**
   * Sponsor a transaction
   * 
   * @param transaction - Base64-encoded unsigned VersionedTransaction
   * @param gridWalletAddress - Grid wallet address (base58)
   * @param gridSession - Grid session object
   * @param gridSessionSecrets - Grid session secrets
   * @returns Sponsored transaction with billing details
   * @throws GatewayError on API errors
   */
  async sponsorTransaction(
    transaction: string,
    gridWalletAddress: string,
    gridSession: any,
    gridSessionSecrets: any
  ): Promise<SponsorshipResult> {
    return await this.makeAuthenticatedRequest<SponsorshipResult>(
      '/transactions/sponsor',
      'POST',
      { transaction },
      gridSession,
      gridSessionSecrets
    );
  }
}

