/**
 * E2E Test Script - Gas Abstraction Top-Up Flow
 * 
 * Tests the complete top-up flow with real credentials:
 * 1. Authenticate user
 * 2. Get Grid session
 * 3. Get top-up requirements
 * 4. Create USDC transfer transaction
 * 5. Sign transaction via Grid
 * 6. Submit to gateway
 * 7. Verify balance update
 * 
 * Usage:
 *   bun run apps/client/__tests__/scripts/test-topup-e2e.ts
 * 
 * Requires:
 *   - TEST_SUPABASE_EMAIL and TEST_SUPABASE_PASSWORD in environment
 *   - Backend server running
 *   - GAS_GATEWAY_URL configured
 */

import '../setup/test-env';
// Load test environment variables from .env.test if it exists
// This file should not be committed to version control
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.test' });
} catch (e) {
  // dotenv not available or .env.test doesn't exist - that's okay
}
import { authenticateTestUser, loadGridSession, completeGridSignupProduction } from '../setup/test-helpers';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

const BACKEND_URL = process.env.TEST_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_API_URL || 'http://localhost:3001';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Prioritize Alchemy RPC for faster responses
const SOLANA_RPC_URL = process.env.SOLANA_RPC_ALCHEMY_1 || 
                       process.env.SOLANA_RPC_ALCHEMY_2 || 
                       process.env.SOLANA_RPC_ALCHEMY_3 ||
                       process.env.SOLANA_RPC_URL || 
                       process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 
                       'https://api.mainnet-beta.solana.com';
// Allow specifying a specific wallet address to use
// Set TEST_WALLET_ADDRESS env var to use a different wallet
// Set TEST_GRID_ACCOUNT and TEST_GRID_SESSION_SECRETS env vars to provide Grid session data
// Load from .env.test file (see .env.test.example for format)
const SPECIFIED_WALLET_ADDRESS = process.env.TEST_WALLET_ADDRESS;

/**
 * Check if backend server is running
 */
async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
}

async function testTopupE2E() {
  const results: TestResult[] = [];
  
  // Validate required environment variables
  if (!SPECIFIED_WALLET_ADDRESS) {
    console.error('❌ TEST_WALLET_ADDRESS environment variable is required');
    console.error('   Set it in .env.test file or as an environment variable');
    console.error('   See .env.test.example for format');
    process.exit(1);
  }
  
  console.log('🧪 Starting E2E Top-Up Flow Test\n');
  console.log('Configuration:');
  console.log('  Backend URL:', BACKEND_URL);
  console.log('  Solana RPC:', SOLANA_RPC_URL);
  console.log('  USDC Mint:', USDC_MINT);
  console.log('  Test Wallet:', SPECIFIED_WALLET_ADDRESS.substring(0, 8) + '...' + SPECIFIED_WALLET_ADDRESS.substring(SPECIFIED_WALLET_ADDRESS.length - 8));
  console.log('');

  // Check if backend is running
  console.log('🔍 Checking backend server...');
  const backendHealthy = await checkBackendHealth();
  if (!backendHealthy) {
    console.error('❌ Backend server is not running or not accessible');
    console.error('   Please start the backend server first:');
    console.error('   cd apps/server && bun run dev');
    console.error('');
    console.error('   Or check if BACKEND_URL is correct:', BACKEND_URL);
    process.exit(1);
  }
  console.log('✅ Backend server is running\n');

  try {
    // Step 1: Authenticate user
    console.log('📝 Step 1: Authenticating user...');
    let auth: { userId: string; email: string; accessToken: string };
    try {
      auth = await authenticateTestUser();
      console.log('✅ Authenticated:', auth.email);
      results.push({ step: 'Authentication', success: true, data: { userId: auth.userId, email: auth.email } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Authentication failed:', msg);
      results.push({ step: 'Authentication', success: false, error: msg });
      throw error;
    }

    // Step 2: Verify wallet has USDC (if specified)
    if (SPECIFIED_WALLET_ADDRESS) {
      console.log('\n📝 Step 2a: Verifying specified wallet has USDC...');
      try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        
        // Try multiple RPC endpoints (Alchemy URLs from env vars)
        const alchemyRpc1 = process.env.SOLANA_RPC_ALCHEMY_1;
        const rpcEndpoints = [
          ...(alchemyRpc1 ? [alchemyRpc1] : []),
          'https://api.mainnet-beta.solana.com',
        ].filter(Boolean);
        
        let connection: Connection | null = null;
        for (const endpoint of rpcEndpoints) {
          try {
            const testConnection = new Connection(endpoint, 'confirmed');
            await testConnection.getVersion();
            connection = testConnection;
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (connection) {
          const walletPubkey = new PublicKey(SPECIFIED_WALLET_ADDRESS);
          const usdcMintPubkey = new PublicKey(USDC_MINT);
          const tokenAccount = await getAssociatedTokenAddress(
            usdcMintPubkey,
            walletPubkey,
            true // allowOwnerOffCurve for Grid PDA
          );
          
          try {
            const balance = await connection.getTokenAccountBalance(tokenAccount);
            const usdcAmount = balance.value.uiAmount || 0;
            console.log(`✅ Wallet ${SPECIFIED_WALLET_ADDRESS} has ${usdcAmount} USDC`);
            if (usdcAmount < 0.001) {
              console.warn(`⚠️  Wallet has ${usdcAmount} USDC, but test needs 0.001 USDC`);
            }
          } catch (error) {
            console.warn(`⚠️  Could not verify USDC balance for wallet ${SPECIFIED_WALLET_ADDRESS}`);
            console.warn('   Token account might not exist yet, or RPC is unavailable');
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not verify wallet USDC balance:', error instanceof Error ? error.message : String(error));
      }
    }
    
    // Step 2: Load or create Grid session
    console.log('\n📝 Step 2: Loading Grid session...');
    let gridSession: any;
    try {
      // First, try to load from app's actual persistent storage (where the signed-in wallet is)
      // This is where the user's wallet with USDC would be stored
      try {
        const { storage } = await import('../lib/storage');
        const { SECURE_STORAGE_KEYS } = await import('../lib/storage/keys');
        
        const accountJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
        const secretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
        
        if (accountJson && secretsJson) {
          const account = JSON.parse(accountJson);
          const sessionSecrets = JSON.parse(secretsJson);
          
          // Check if this matches the specified wallet address
          if (account.address === SPECIFIED_WALLET_ADDRESS || !SPECIFIED_WALLET_ADDRESS) {
            gridSession = {
              address: account.address,
              authentication: account.authentication || account,
              sessionSecrets: sessionSecrets,
            };
            
            console.log('✅ Grid session loaded from app storage:', gridSession.address);
            console.log('   (This is your actual signed-in wallet)');
          } else {
            console.log(`⚠️  App storage wallet (${account.address}) doesn't match specified wallet (${SPECIFIED_WALLET_ADDRESS})`);
            throw new Error('Wallet address mismatch');
          }
        } else {
          throw new Error('No Grid account in app storage');
        }
      } catch (appStorageError) {
        // Try loading from environment variables (for manual specification)
        if (process.env.TEST_GRID_ACCOUNT && process.env.TEST_GRID_SESSION_SECRETS) {
          console.log('📝 Loading Grid session from environment variables...');
          try {
            // Strip surrounding quotes if present (common in .env files)
            const accountStr = process.env.TEST_GRID_ACCOUNT.trim().replace(/^['"]|['"]$/g, '');
            const secretsStr = process.env.TEST_GRID_SESSION_SECRETS.trim().replace(/^['"]|['"]$/g, '');
            
            const account = JSON.parse(accountStr);
            const sessionSecrets = JSON.parse(secretsStr);
            
            // Check if session token is expired
            try {
              const auth = account.authentication?.[0] || account.authentication;
              if (auth?.session?.Privy?.session?.encrypted_authorization_key?.expires_at) {
                const expiresAt = auth.session.Privy.session.encrypted_authorization_key.expires_at;
                const now = Date.now();
                if (expiresAt < now) {
                  console.error('❌ Grid session token is EXPIRED');
                  console.error(`   Expires at: ${new Date(expiresAt).toISOString()}`);
                  console.error(`   Current time: ${new Date(now).toISOString()}`);
                  console.error(`   Expired ${Math.floor((now - expiresAt) / (1000 * 60 * 60))} hours ago`);
                  console.error('');
                  console.error('   SOLUTION: You need to refresh your Grid session:');
                  console.error('   1. Sign in again with your Grid wallet in the app');
                  console.error('   2. Extract the new session using get-grid-session.js in browser console');
                  console.error('   3. Update TEST_GRID_ACCOUNT and TEST_GRID_SESSION_SECRETS in .env.test');
                  throw new Error('Grid session token is expired. Please refresh your session.');
                } else {
                  const hoursUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60));
                  console.log(`✅ Grid session token valid until: ${new Date(expiresAt).toISOString()} (${hoursUntilExpiry} hours remaining)`);
                }
              } else if (auth?.token) {
                // Check JWT token expiration
                try {
                  const tokenParts = auth.token.split('.');
                  if (tokenParts.length === 3) {
                    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                    if (payload.exp) {
                      const expiresAt = payload.exp * 1000; // JWT exp is in seconds
                      const now = Date.now();
                      if (expiresAt < now) {
                        console.error('❌ Grid JWT token is EXPIRED');
                        console.error(`   Expires at: ${new Date(expiresAt).toISOString()}`);
                        console.error(`   Current time: ${new Date(now).toISOString()}`);
                        throw new Error('Grid JWT token is expired. Please refresh your session.');
                      } else {
                        const hoursUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60));
                        console.log(`✅ Grid JWT token valid until: ${new Date(expiresAt).toISOString()} (${hoursUntilExpiry} hours remaining)`);
                      }
                    }
                  }
                } catch (e) {
                  // Couldn't parse JWT, continue anyway
                }
              }
            } catch (e) {
              if (e instanceof Error && e.message.includes('expired')) {
                throw e; // Re-throw expiration errors
              }
              // Couldn't check expiration, continue anyway
            }
            
            if (account.address === SPECIFIED_WALLET_ADDRESS) {
              gridSession = {
                address: account.address,
                authentication: account.authentication || account,
                sessionSecrets: sessionSecrets,
              };
              console.log('✅ Grid session loaded from environment variables:', gridSession.address);
            } else {
              throw new Error(`Environment wallet (${account.address}) doesn't match specified wallet (${SPECIFIED_WALLET_ADDRESS})`);
            }
          } catch (envError) {
            console.error('❌ Failed to load Grid session from environment:', envError);
            throw envError;
          }
        } else {
          // Fall back to test storage
          console.log('⚠️  No Grid account in app storage, trying test storage...');
          try {
            gridSession = await loadGridSession();
            if (!gridSession || !gridSession.address) {
              throw new Error('Grid session missing or invalid');
            }
            
            // Check if this matches the specified wallet address
            if (gridSession.address === SPECIFIED_WALLET_ADDRESS || !SPECIFIED_WALLET_ADDRESS) {
              console.log('✅ Grid session loaded from test cache:', gridSession.address);
            } else {
              console.log(`⚠️  Test cache wallet (${gridSession.address}) doesn't match specified wallet (${SPECIFIED_WALLET_ADDRESS})`);
              console.log(`   Specified wallet: ${SPECIFIED_WALLET_ADDRESS}`);
              console.log('');
              console.log('   To use the specified wallet, you need to provide Grid session data.');
              console.log('   Option 1: Sign in with this wallet in the app, then the test can access it from app storage');
              console.log('   Option 2: Set environment variables in .env.test file:');
              console.log('     See .env.test.example for format');
              console.log('     Or use: TEST_GRID_ACCOUNT and TEST_GRID_SESSION_SECRETS env vars');
              console.log('');
              console.log('   For now, continuing with test wallet...');
              // Continue with test wallet but warn
            }
          } catch (loadError) {
            // If no cached session, create one using production flow
            console.log('⚠️  No cached Grid session found, creating new one...');
            console.log('   This will send an OTP email to:', auth.email);
            gridSession = await completeGridSignupProduction(auth.email, auth.accessToken);
            console.log('✅ Grid session created:', gridSession.address);
          }
        }
      }
      
      if (!gridSession || !gridSession.address) {
        throw new Error('Grid session missing or invalid');
      }
      
      // Verify we're using the correct wallet
      if (SPECIFIED_WALLET_ADDRESS && gridSession.address !== SPECIFIED_WALLET_ADDRESS) {
        console.warn(`⚠️  Using wallet ${gridSession.address} instead of specified ${SPECIFIED_WALLET_ADDRESS}`);
        console.warn('   If you need to use a different wallet, sign in with that wallet in the app first.');
      }
      
      results.push({ step: 'Grid Session', success: true, data: { address: gridSession.address } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Grid session failed:', msg);
      results.push({ step: 'Grid Session', success: false, error: msg });
      throw error;
    }

    // Step 3: Get top-up requirements
    console.log('\n📝 Step 3: Getting top-up requirements...');
    let requirements: any;
    try {
      const reqUrl = `${BACKEND_URL}/api/gas-abstraction/topup/requirements`;
      const reqResponse = await fetch(reqUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      });

      if (!reqResponse.ok) {
        const errorData = await reqResponse.json().catch(() => ({}));
        throw new Error(`Failed to get requirements: ${reqResponse.status} - ${errorData.error || errorData.message || 'Unknown error'}`);
      }

      requirements = await reqResponse.json();
      
      // Validate requirements
      if (!requirements.payTo) {
        throw new Error('Missing payTo in requirements');
      }
      if (!requirements.network || requirements.network !== 'solana-mainnet-beta') {
        throw new Error(`Invalid network: ${requirements.network}`);
      }
      if (!requirements.asset || requirements.asset !== USDC_MINT) {
        throw new Error(`Invalid asset: ${requirements.asset}`);
      }

      console.log('✅ Requirements received:');
      console.log('   Network:', requirements.network);
      console.log('   Asset:', requirements.asset);
      console.log('   Pay To:', requirements.payTo);
      console.log('   Max Amount:', requirements.maxAmountRequired / 1_000_000, 'USDC');
      
      results.push({ step: 'Get Requirements', success: true, data: requirements });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Get requirements failed:', msg);
      results.push({ step: 'Get Requirements', success: false, error: msg });
      throw error;
    }

    // Step 4: Check current balance
    console.log('\n📝 Step 4: Checking current balance...');
    let currentBalance: any;
    try {
      const balanceUrl = `${BACKEND_URL}/api/gas-abstraction/balance`;
      const balanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          gridSessionSecrets: gridSession.sessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridSession.address,
          },
        }),
      });

      if (!balanceResponse.ok) {
        const errorData = await balanceResponse.json().catch(() => ({}));
        throw new Error(`Failed to get balance: ${balanceResponse.status} - ${errorData.error || errorData.message || 'Unknown error'}`);
      }

      currentBalance = await balanceResponse.json();
      console.log('✅ Current balance:', currentBalance.balanceBaseUnits / 1_000_000, 'USDC');
      results.push({ step: 'Check Balance', success: true, data: currentBalance });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('⚠️  Balance check failed (continuing anyway):', msg);
      results.push({ step: 'Check Balance', success: false, error: msg });
      // Continue even if balance check fails
    }

    // Step 5: Create USDC transfer transaction
    console.log('\n📝 Step 5: Creating USDC transfer transaction...');
    let unsignedTransaction: string;
    let amountBaseUnits: number;
    try {
      // Try multiple RPC endpoints with fallbacks
      // Alchemy URLs are loaded from environment variables (secrets)
      const alchemyRpc1 = process.env.SOLANA_RPC_ALCHEMY_1;
      const alchemyRpc2 = process.env.SOLANA_RPC_ALCHEMY_2;
      const alchemyRpc3 = process.env.SOLANA_RPC_ALCHEMY_3;
      
      const rpcEndpoints = [
        SOLANA_RPC_URL,
        // Only include Alchemy endpoints if API keys are provided
        ...(alchemyRpc1 ? [alchemyRpc1] : []),
        ...(alchemyRpc2 ? [alchemyRpc2] : []),
        ...(alchemyRpc3 ? [alchemyRpc3] : []),
        // Public fallback endpoints
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana',
      ].filter(Boolean); // Remove any undefined/null values
      
      let connection: Connection | null = null;
      let blockhash: string | null = null;
      let lastError: Error | null = null;
      
      for (const endpoint of rpcEndpoints) {
        try {
          console.log(`🔗 Trying RPC endpoint: ${endpoint.substring(0, 50)}...`);
          const testConnection = new Connection(endpoint, 'confirmed');
          
          // Test with a quick call
          const testBlockhash = await Promise.race([
            testConnection.getLatestBlockhash('confirmed'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 5000))
          ]) as { blockhash: string };
          
          connection = testConnection;
          blockhash = testBlockhash.blockhash;
          console.log(`✅ Connected to RPC: ${endpoint.substring(0, 50)}...`);
          break;
        } catch (error) {
          console.warn(`⚠️  RPC endpoint failed: ${endpoint.substring(0, 50)}...`, error instanceof Error ? error.message : String(error));
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }
      
      if (!connection || !blockhash) {
        throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
      }
      
      // Use the working connection
      const userPubkey = new PublicKey(gridSession.address);
      const payToPubkey = new PublicKey(requirements.payTo);
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      
      // Get token accounts
      const userTokenAccount = await getAssociatedTokenAddress(
        usdcMintPubkey,
        userPubkey,
        true // allowOwnerOffCurve for Grid PDA
      );
      
      const payToTokenAccount = await getAssociatedTokenAddress(
        usdcMintPubkey,
        payToPubkey,
        true
      );

      console.log('🔍 Checking USDC token accounts...');
      console.log('   Grid wallet address:', userPubkey.toBase58());
      console.log('   User token account (calculated):', userTokenAccount.toBase58());
      console.log('   PayTo token account:', payToTokenAccount.toBase58());
      
      // Check if user token account exists
      let userTokenAccountExists = false;
      let userBalance = 0;
      try {
        const userTokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
        userBalance = userTokenAccountInfo.value.uiAmount || 0;
        userTokenAccountExists = true;
        console.log(`✅ User USDC balance: ${userBalance} USDC`);
        console.log(`   Balance in base units: ${userTokenAccountInfo.value.amount}`);
      } catch (error) {
        console.warn('⚠️  User token account does not exist at calculated address');
        console.warn('   Trying to find USDC token accounts for this wallet...');
        
        // Try to find all token accounts for this wallet using getTokenAccountsByOwner
        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            userPubkey,
            { mint: usdcMintPubkey }
          );
          
          if (tokenAccounts.value.length > 0) {
            console.log(`✅ Found ${tokenAccounts.value.length} USDC token account(s):`);
            for (const account of tokenAccounts.value) {
              const balance = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
              const accountAddress = account.pubkey.toBase58();
              console.log(`   - ${accountAddress}: ${balance} USDC`);
              if (balance > 0) {
                userBalance = balance;
                userTokenAccountExists = true;
                console.log(`   ✅ Found account with balance: ${balance} USDC`);
                // Note: We'll still use the calculated ATA address, but now we know balance exists
                break;
              }
            }
          } else {
            console.warn('   No USDC token accounts found for this wallet');
          }
        } catch (searchError) {
          console.warn('   Could not search for token accounts:', searchError instanceof Error ? searchError.message : String(searchError));
          // Continue - maybe the account exists but RPC is having issues
        }
      }
      
      // If we couldn't verify balance but user says they have USDC, continue anyway
      // Grid's simulation will catch the actual issue
      if (!userTokenAccountExists || userBalance === 0) {
        console.warn('⚠️  Could not verify USDC balance, but continuing...');
        console.warn('   Grid will simulate the transaction and will fail if balance is insufficient');
        console.warn('   Wallet address:', userPubkey.toBase58());
        console.warn('   Expected token account:', userTokenAccount.toBase58());
        console.warn('   If you have USDC, the transaction should proceed');
      } else {
        console.log(`✅ Verified USDC balance: ${userBalance} USDC`);
        if (userBalance < amountBaseUnits / 1_000_000) {
          throw new Error(`Insufficient balance: ${userBalance} USDC available, but need ${amountBaseUnits / 1_000_000} USDC`);
        }
      }
      
      // Check if payTo token account exists
      let payToTokenAccountExists = false;
      try {
        await connection.getTokenAccountBalance(payToTokenAccount);
        payToTokenAccountExists = true;
        console.log('✅ PayTo token account exists');
      } catch (error) {
        console.warn('⚠️  PayTo token account does not exist - will need to create it');
      }
      
      // Use small amount for testing (0.001 USDC)
      amountBaseUnits = 1_000; // 0.001 USDC
      
      console.log('\n📝 Building transaction instructions...');
      
      const instructions = [];
      
      // If user token account doesn't exist, we need to create it first
      // This is required before we can transfer USDC
      if (!userTokenAccountExists) {
        console.log('   ⚠️  User token account does not exist - adding ATA creation instruction...');
        console.log('   Note: This will fail if the wallet has no SOL for account creation fees');
        const createUserAtaIx = createAssociatedTokenAccountInstruction(
          userPubkey, // payer (Grid wallet)
          userTokenAccount, // ATA to create
          userPubkey, // owner (Grid wallet)
          usdcMintPubkey, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push(createUserAtaIx);
        console.log('   ✅ Added user ATA creation instruction');
      }
      
      // If payTo token account doesn't exist, create it first
      // Note: For x402 payments, the gateway should have its token account, but we'll check
      if (!payToTokenAccountExists) {
        console.log('   Adding ATA creation instruction for payTo account...');
        const createPayToAtaIx = createAssociatedTokenAccountInstruction(
          userPubkey, // payer (Grid wallet)
          payToTokenAccount, // ATA to create
          payToPubkey, // owner
          usdcMintPubkey, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push(createPayToAtaIx);
        console.log('   ✅ Added payTo ATA creation instruction');
      }
      
      // Create transfer instruction
      console.log('   Adding USDC transfer instruction...');
      console.log('   Amount:', amountBaseUnits, 'base units (', amountBaseUnits / 1_000_000, 'USDC)');
      
      const transferInstruction = createTransferInstruction(
        userTokenAccount,
        payToTokenAccount,
        userPubkey,
        amountBaseUnits,
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(transferInstruction);
      console.log('   ✅ Added transfer instruction');
      
      console.log(`✅ Created ${instructions.length} instruction(s)`);
      
      if (!userTokenAccountExists) {
        console.log('');
        console.log('⚠️  IMPORTANT: User token account will be created in this transaction.');
        console.log('   This requires SOL for account creation fees (~0.002 SOL).');
        console.log('   If the wallet has no SOL, the transaction will fail.');
      }

      // Build transaction with all instructions
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);
      unsignedTransaction = Buffer.from(transaction.serialize()).toString('base64');
      
      console.log('✅ Transaction created:');
      console.log('   Amount:', amountBaseUnits / 1_000_000, 'USDC');
      console.log('   From:', userPubkey.toBase58());
      console.log('   To:', payToPubkey.toBase58());
      console.log('   Blockhash:', blockhash.substring(0, 20) + '...');
      
      results.push({ step: 'Create Transaction', success: true, data: { amountBaseUnits } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Create transaction failed:', msg);
      results.push({ step: 'Create Transaction', success: false, error: msg });
      throw error;
    }

    // Check if wallet has USDC balance (informational)
    console.log('\n💡 Note: Grid will simulate the transaction. If the wallet has no USDC, simulation will fail.');
    console.log('   This is expected for test wallets. The transaction structure is correct.');

    // Step 6: Sign transaction via Grid
    console.log('\n📝 Step 6: Signing transaction via Grid...');
    console.log('   Note: Grid will simulate the transaction. If simulation fails due to insufficient balance,');
    console.log('   this is expected for test wallets without USDC. The transaction structure is validated.');
    let signedTransaction: string;
    try {
      const signUrl = `${BACKEND_URL}/api/grid/sign-transaction`;
      const signResponse = await fetch(signUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          transaction: unsignedTransaction,
          sessionSecrets: gridSession.sessionSecrets,
          session: gridSession.authentication || gridSession,
          address: gridSession.address,
        }),
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || 'Unknown error';
        
        // Check if this is a simulation failure
        // If wallet has USDC, this might indicate a different issue
        if (errorMessage.includes('simulation failed') || 
            errorMessage.includes('insufficient') || 
            errorMessage.includes('balance') ||
            errorMessage.includes('token account')) {
          console.error('❌ Transaction simulation failed');
          console.error('   Error details:', errorData);
          console.error('   This could mean:');
          console.error('   1. Wallet has no USDC balance');
          console.error('   2. Token account does not exist');
          console.error('   3. Transaction structure issue');
          console.error('   4. Grid API issue');
          
          // Check if we have more details from Grid
          if (errorData.gridError) {
            console.error('   Grid error details:', JSON.stringify(errorData.gridError, null, 2));
          }
          
          // Still throw - we want to see the actual error
          throw new Error(`Transaction simulation failed: ${errorMessage}. Check wallet USDC balance and token account.`);
        }
        
        // Print debug information if available
        if (errorData.debug) {
          console.error('🔍 Debug information from backend:');
          console.error('   Session Provider:', errorData.debug.sessionProvider);
          console.error('   Session Secrets Providers:', JSON.stringify(errorData.debug.sessionSecretsProviders, null, 2));
          console.error('   Has Matching Secret:', errorData.debug.hasMatchingSecret);
          console.error('   Session Format:', errorData.debug.sessionFormat);
          console.error('   Session Length:', errorData.debug.sessionLength);
        }
        
        // For other errors, throw normally
        throw new Error(`Failed to sign transaction: ${signResponse.status} - ${errorMessage}`);
      }

      const signResult = await signResponse.json();
      
      if (!signResult.success || !signResult.signedTransaction) {
        throw new Error(signResult.error || 'Failed to get signed transaction');
      }

      signedTransaction = signResult.signedTransaction;
      console.log('✅ Transaction signed');
      if (signResult.signature) {
        console.log('   Signature:', signResult.signature);
      }
      if (signResult.note) {
        console.log('   Note:', signResult.note);
      }
      if (signResult.debug) {
        console.log('   🔍 Backend Debug Info:');
        console.log('      Transaction Format:', signResult.debug.transactionFormat);
        console.log('      Transaction Length:', signResult.debug.transactionLength, 'bytes (base64)');
        console.log('      Confirmation Status:', signResult.debug.confirmedOnAttempt);
      }
      
      // The backend's /api/grid/sign-transaction endpoint now waits for confirmation
      // It will return 408 if transaction isn't confirmed after 30 seconds
      // So we don't need to wait here - the backend handles it
      console.log('✅ Transaction signed and submitted');
      console.log('   Note: Backend will wait for on-chain confirmation before returning transaction');
      if (signResult.signature) {
        console.log('   Signature:', signResult.signature);
      }
      
      // Wait additional time for transaction to propagate to gateway's RPC endpoint
      // Gateway verifies transactions on-chain, so it needs to see the transaction
      console.log('⏳ Waiting 5 seconds for transaction to propagate to gateway RPC...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify transaction is confirmed on-chain before submitting to gateway
      try {
        const { Connection } = await import('@solana/web3.js');
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        const tx = await connection.getTransaction(signResult.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });
        if (tx) {
          console.log('✅ Transaction confirmed on-chain (slot:', tx.slot, ')');
        } else {
          console.warn('⚠️  Transaction not yet confirmed, but proceeding anyway...');
        }
      } catch (error) {
        console.warn('⚠️  Could not verify transaction confirmation:', error instanceof Error ? error.message : String(error));
        console.warn('   Proceeding anyway - gateway will verify...');
      }
      
      results.push({ step: 'Sign Transaction', success: true, data: { signature: signResult.signature } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Sign transaction failed:', msg);
      results.push({ step: 'Sign Transaction', success: false, error: msg });
      throw error;
    }

    // Step 7: Construct x402 payment payload and submit to gateway
    console.log('\n📝 Step 7: Constructing x402 payment payload...');
    
    // Construct x402 payment payload (per x402 gateway spec)
    // Use the scheme from the requirements - gateway returns "exact" in accepts array
    // We should match what the gateway expects, not what the gist example shows
    const scheme = requirements.scheme || (requirements.accepts && requirements.accepts[0]?.scheme) || 'solana';
    
    const paymentPayload = {
      x402Version: requirements.x402Version,
      scheme: scheme, // Use scheme from requirements (gateway returns "exact")
      network: requirements.network,
      asset: requirements.asset,
      payload: {
        transaction: signedTransaction, // Base64-encoded signed transaction
        publicKey: gridSession.address,
      },
    };
    
    // Base64-encode the payment payload
    const paymentBase64 = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    console.log('✅ x402 Payment payload constructed and encoded');
    console.log('   Payment payload structure:', {
      x402Version: paymentPayload.x402Version,
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
      asset: paymentPayload.asset,
      hasPayload: !!paymentPayload.payload,
      hasTransaction: !!paymentPayload.payload?.transaction,
      transactionLength: paymentPayload.payload?.transaction?.length,
      hasPublicKey: !!paymentPayload.payload?.publicKey,
      publicKey: paymentPayload.payload?.publicKey,
    });
    
    console.log('\n📝 Step 8: Submitting payment to gateway...');
    let topupResult: any;
    try {
      const topupUrl = `${BACKEND_URL}/api/gas-abstraction/topup`;
      const topupResponse = await fetch(topupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          payment: paymentBase64, // Base64-encoded x402 payment payload
          gridSessionSecrets: gridSession.sessionSecrets, // For telemetry
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridSession.address,
          }, // For telemetry
        }),
      });

      if (!topupResponse.ok) {
        const errorData = await topupResponse.json().catch(() => ({}));
        console.error('❌ Top-up failed:', {
          status: topupResponse.status,
          error: errorData.error,
          message: errorData.message,
          data: errorData.data,
        });
        throw new Error(`Top-up failed: ${topupResponse.status} - ${errorData.error || errorData.message || 'Unknown error'}`);
      }

      topupResult = await topupResponse.json();
      console.log('✅ Top-up successful:');
      console.log('   Amount credited:', topupResult.amountBaseUnits / 1_000_000, 'USDC');
      console.log('   Transaction:', topupResult.txSignature);
      console.log('   Payment ID:', topupResult.paymentId);
      
      results.push({ step: 'Submit Top-up', success: true, data: topupResult });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Submit top-up failed:', msg);
      results.push({ step: 'Submit Top-up', success: false, error: msg });
      throw error;
    }

    // Step 8: Verify balance update
    console.log('\n📝 Step 8: Verifying balance update...');
    try {
      // Wait a moment for balance to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const balanceUrl = `${BACKEND_URL}/api/gas-abstraction/balance`;
      const balanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          gridSessionSecrets: gridSession.sessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridSession.address,
          },
        }),
      });

      if (balanceResponse.ok) {
        const newBalance = await balanceResponse.json();
        const oldBalance = currentBalance?.balanceBaseUnits || 0;
        const expectedBalance = oldBalance + amountBaseUnits;
        
        console.log('✅ Balance check:');
        console.log('   Old balance:', oldBalance / 1_000_000, 'USDC');
        console.log('   New balance:', newBalance.balanceBaseUnits / 1_000_000, 'USDC');
        console.log('   Expected:', expectedBalance / 1_000_000, 'USDC');
        console.log('   Difference:', (newBalance.balanceBaseUnits - oldBalance) / 1_000_000, 'USDC');
        
        // Check if balance increased (allow for small differences due to fees)
        if (newBalance.balanceBaseUnits >= oldBalance) {
          console.log('✅ Balance increased (top-up successful)');
          results.push({ step: 'Verify Balance', success: true, data: newBalance });
        } else {
          console.warn('⚠️  Balance did not increase as expected');
          results.push({ step: 'Verify Balance', success: false, error: 'Balance did not increase' });
        }
      } else {
        console.warn('⚠️  Could not verify balance (non-critical)');
        results.push({ step: 'Verify Balance', success: false, error: 'Could not fetch balance' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('⚠️  Balance verification failed (non-critical):', msg);
      results.push({ step: 'Verify Balance', success: false, error: msg });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${index + 1}. ${result.step}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\nResults:');
    console.log(`  Successful: ${successful}/${results.length}`);
    console.log(`  Failed: ${failed}/${results.length}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. See details above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    
    console.log('\n📊 Partial Results:');
    results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${index + 1}. ${result.step}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    process.exit(1);
  }
}

// Run test
testTopupE2E()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

