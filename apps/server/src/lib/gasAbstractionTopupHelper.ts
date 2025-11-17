/**
 * Gas Abstraction Top-Up Helper
 * 
 * Optional server-side helper for creating top-up payments using ephemeral wallet.
 * The primary flow is client-side (client creates and signs transaction), but this
 * provides an alternative server-side option using the existing x402 payment infrastructure.
 * 
 * Requirements: 6.1, 6.2, 6.3, 11.1, 11.2, 11.3, 11.4
 */

import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { EphemeralWalletManager, type GridTokenSender } from '@darkresearch/mallory-shared/x402/EphemeralWalletManager.js';
import type { X402PaymentRequirement, X402Payment } from '../lib/x402GasAbstractionService.js';
import type { GasAbstractionConfig } from './gasAbstractionConfig.js';

/**
 * Create top-up payment using ephemeral wallet
 * 
 * This is an optional server-side helper. The primary flow is client-side where
 * the client creates and signs the USDC transfer transaction directly.
 * 
 * @param requirements - Payment requirements from gateway
 * @param amountBaseUnits - Amount to top up in base units (optional, defaults to maxAmountRequired)
 * @param gridWalletAddress - Grid wallet address
 * @param gridSender - Grid token sender interface
 * @param config - Gas abstraction configuration
 * @returns x402 payment payload ready for submission
 */
export async function createTopupPaymentWithEphemeralWallet(
  requirements: X402PaymentRequirement,
  amountBaseUnits: number | undefined,
  gridWalletAddress: string,
  gridSender: GridTokenSender,
  config: GasAbstractionConfig
): Promise<X402Payment> {
  const amount = amountBaseUnits || requirements.maxAmountRequired;
  const amountUsdc = amount / 1_000_000; // Convert to USDC (6 decimals)
  
  console.log('💰 [Gas Top-up] Creating payment with ephemeral wallet:', {
    amountBaseUnits: amount,
    amountUsdc,
    payTo: requirements.payTo
  });

  // Create ephemeral wallet manager
  const walletManager = new EphemeralWalletManager(config.solanaRpcUrl, gridSender);
  const { keypair: ephemeralKeypair, address: ephemeralAddress } = walletManager.create();

  try {
    // Fund ephemeral wallet from Grid
    // Need small amount of USDC for payment + small amount of SOL for fees
    const usdcAmount = amountUsdc.toFixed(6);
    const solAmount = '0.01'; // Small amount for transaction fees
    
    console.log('💰 [Gas Top-up] Funding ephemeral wallet...');
    const funding = await walletManager.fund(
      ephemeralAddress,
      usdcAmount,
      solAmount,
      config.usdcMint
    );
    
    console.log('✅ [Gas Top-up] Ephemeral wallet funded');

    // Create connection
    const connection = new Connection(config.solanaRpcUrl, 'confirmed');

    // Wait for funds to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify funds
    const solBalance = await connection.getBalance(ephemeralKeypair.publicKey);
    const usdcAta = await getAssociatedTokenAddress(
      new PublicKey(config.usdcMint),
      ephemeralKeypair.publicKey
    );
    const usdcBalance = await connection.getTokenAccountBalance(usdcAta);
    
    console.log('✅ [Gas Top-up] Funds verified:', {
      sol: solBalance / 1_000_000_000,
      usdc: usdcBalance.value.uiAmountString
    });

    // Create USDC transfer transaction from ephemeral wallet to payTo address
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const payToPubkey = new PublicKey(requirements.payTo);
    const payToAta = await getAssociatedTokenAddress(
      new PublicKey(config.usdcMint),
      payToPubkey,
      true // allowOwnerOffCurve
    );

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      usdcAta,
      payToAta,
      ephemeralKeypair.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );

    // Build transaction
    const message = new TransactionMessage({
      payerKey: ephemeralKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [transferInstruction]
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    transaction.sign([ephemeralKeypair]);

    // Serialize transaction
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
    const publicKey = ephemeralKeypair.publicKey.toBase58();

    // Construct x402 payment payload
    const payment: X402Payment = {
      x402Version: requirements.x402Version,
      scheme: requirements.scheme,
      network: requirements.network,
      asset: requirements.asset,
      payload: {
        transaction: serializedTx,
        publicKey: publicKey
      }
    };

    console.log('✅ [Gas Top-up] Payment payload created');

    // Sweep remaining funds back to Grid (async, don't wait)
    walletManager.sweepAll(ephemeralKeypair, gridWalletAddress, config.usdcMint)
      .then(result => {
        console.log('✅ [Gas Top-up] Ephemeral wallet swept:', result);
      })
      .catch(error => {
        console.warn('⚠️ [Gas Top-up] Sweep failed (funds may be stuck):', error);
      });

    return payment;

  } catch (error) {
    console.error('❌ [Gas Top-up] Payment creation failed:', error);
    
    // Attempt emergency cleanup
    try {
      await walletManager.sweepAll(ephemeralKeypair, gridWalletAddress, config.usdcMint);
    } catch (cleanupError) {
      console.warn('⚠️ [Gas Top-up] Emergency cleanup failed:', cleanupError);
    }
    
    throw error;
  }
}

