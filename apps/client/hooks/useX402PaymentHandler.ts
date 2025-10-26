import { useEffect, useRef } from 'react';
import { X402PaymentService } from '../features/x402';
import type { X402PaymentRequirement } from '@darkresearch/mallory-shared';
import { useWallet } from '../contexts/WalletContext';

interface UseX402PaymentHandlerProps {
  messages: any[];
  onPaymentFulfilled: (data: any, toolName: string) => void;
}

export function useX402PaymentHandler({ messages, onPaymentFulfilled }: UseX402PaymentHandlerProps) {
  const processedToolCalls = useRef(new Set<string>());
  const { walletData } = useWallet();

  useEffect(() => {
    console.log('🔍 [x402 Debug] useX402PaymentHandler triggered', {
      messageCount: messages.length
    });

    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    console.log('🔍 [x402 Debug] Last message:', {
      role: lastMessage.role,
      id: lastMessage.id,
      hasParts: !!lastMessage.parts,
      partsLength: lastMessage.parts?.length,
      partsTypes: lastMessage.parts?.map((p: any) => p.type)
    });

    if (lastMessage.role !== 'assistant') return;

    // Tool data is in parts array, not toolInvocations
    const parts = lastMessage.parts || [];
    
    console.log('🔍 [x402] Scanning parts for payment requirements:', {
      partsCount: parts.length,
      partsTypes: parts.map((p: any) => p.type)
    });
    
    for (const part of parts) {
      // Look for tool parts with output (type starts with "tool-" like "tool-nansenHistoricalBalances")
      if (part.type?.startsWith('tool-') && part.state === 'output-available' && part.output?.needsPayment) {
        const paymentReq = part.output as X402PaymentRequirement;
        const toolCallId = part.toolCallId || `${paymentReq.toolName}-${Date.now()}`;
        
        console.log('🎯 [x402] Found payment requirement:', paymentReq);
        
        if (processedToolCalls.current.has(toolCallId)) {
          console.log('⏭️ [x402] Already processed this tool call');
          continue;
        }
        
        const { amount, currency } = paymentReq.estimatedCost;
        
        console.log('🔍 [x402] Checking auto-approve:', { amount, currency });
        
        if (X402PaymentService.shouldAutoApprove(amount, currency)) {
          console.log(`💰 Auto-approving x402 payment: ${amount} ${currency}`);
          
          // Get Grid wallet address from WalletContext (server-managed wallet)
          const gridAddress = walletData?.smartAccountAddress;
          if (!gridAddress) {
            console.error('❌ [x402] No Grid wallet address available in WalletContext');
            processedToolCalls.current.add(toolCallId);
            return;
          }
          
          console.log('✅ [x402] Using Grid address from WalletContext:', gridAddress);
          
          // Mark as processed BEFORE starting async work to prevent duplicate calls
          processedToolCalls.current.add(toolCallId);
          
          X402PaymentService.payAndFetchData(paymentReq, gridAddress)
            .then(data => {
              console.log('✅ x402 payment successful, data received');
              onPaymentFulfilled(data, paymentReq.toolName);
            })
            .catch(err => {
              console.error('❌ x402 payment failed:', err);
              // Remove from processed set on error so it can be retried
              processedToolCalls.current.delete(toolCallId);
            });
        } else {
          console.log(`⚠️ Payment requires manual approval: ${amount} ${currency}`);
          // Mark as processed to prevent repeated approval requests
          processedToolCalls.current.add(toolCallId);
        }
      }
    }
  }, [messages, onPaymentFulfilled]);
}

