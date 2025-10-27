/**
 * Mallory Shared Package
 * Types and utilities shared between client and server
 */

// API Types
export type {
  ChatMessage,
  ChatRequest,
  HoldingsRequest,
  HoldingsResponse,
  TokenHolding,
  ApiError
} from './types/api';

// Wallet Types
export type {
  WalletBalance,
  TransactionRequest,
  TransactionResponse,
  GridAccount,
  GridAccountStatus
} from './types/wallet';

// x402 Payment Types and Utilities
export * from './x402';
export { EphemeralWalletManager, type GridTokenSender } from './x402/EphemeralWalletManager';
export { X402PaymentService } from './x402/X402PaymentService';
