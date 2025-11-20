# Gas Credits User Guide

## What are Gas Credits?

Gas credits are USDC you pre-pay so Mallory can cover your Solana network fees. Instead of needing SOL in your wallet to pay for transaction fees, you can use USDC credits that are automatically deducted when you make transactions.

## Key Benefits

- **No SOL Required**: Make Solana transactions without holding SOL for gas fees
- **Automatic Refunds**: If a transaction fails or expires, your gas credits are automatically refunded
- **Easy Top-Up**: Add credits anytime with a simple USDC transfer
- **Transparent Pricing**: See exactly how much each transaction costs in USDC

## Getting Started

### Enabling Gasless Mode

1. Open the **Gas Credits** screen from the main navigation
2. Toggle **Gasless Mode** to enabled
3. Your preference is saved automatically

When gasless mode is enabled, Mallory will automatically use your gas credits to pay for transaction fees instead of requiring SOL.

### Checking Your Balance

Your gas credit balance is displayed at the top of the Gas Credits screen:

- **Current Balance**: Total USDC credits available
- **Pending**: Amount reserved for transactions that haven't settled yet
- **Available**: Balance minus pending (what you can actually use)

The balance automatically refreshes when you:
- Open the Gas Credits screen
- Return from a top-up
- Prepare to send a transaction
- Return to the app after it's been in the background

### Low Balance Warning

If your balance drops below 0.1 USDC, you'll see a warning banner:

> "You have <0.1 USDC gas credits left. Top up now to avoid failures."

Tap **Top Up** in the banner to quickly add more credits.

## Topping Up Gas Credits

### Step 1: Open Top-Up Modal

Tap the **Top Up** button on the Gas Credits screen.

### Step 2: Choose Amount

You can:
- Select a suggested amount (0.5, 1, 5, or 10 USDC)
- Enter a custom amount (minimum 0.5 USDC, maximum 100 USDC)

The default amount is shown based on the gateway's recommended top-up.

### Step 3: Review and Confirm

Review the message:
> "You will send X USDC to purchase gas credits. Fees may apply."

Tap **Confirm** to proceed.

### Step 4: Sign Transaction

Mallory will create a USDC transfer transaction. Sign it with your wallet to complete the top-up.

### Step 5: Confirmation

Once the payment is verified, you'll see:
> "Top-up successful. +X USDC added to gas credits."

Your balance will automatically update.

## Using Gas Credits

### In Send Modal

When sending tokens or SOL:

1. Toggle **Gasless Mode** above the send button
2. When enabled, you'll see: "This action will use your gas credits instead of SOL."
3. The estimated cost is shown in USDC
4. Complete the transaction as normal

### In AI Chat

When the AI initiates transactions (e.g., sending tokens, interacting with smart contracts):

- If gasless mode is enabled, transactions are automatically sponsored
- You'll see a notification showing the USDC cost
- The transaction proceeds without requiring SOL

### Insufficient Balance

If you don't have enough credits:

1. You'll see: "Not enough gas credits. Top up?"
2. Choose to:
   - **Top Up Now**: Opens the top-up flow
   - **Use SOL**: Falls back to paying with SOL (if you have it)

## Transaction History

The Gas Credits screen shows your transaction history:

### Top-Ups

- **Date**: When you added credits
- **Amount**: USDC added
- **Transaction**: Click to view on Solana explorer

### Sponsored Transactions

- **Date**: When transaction was sponsored
- **Amount**: USDC debited
- **Status**:
  - 🟡 **Pending**: Transaction is being processed
  - 🟢 **Settled**: Transaction confirmed, credits deducted
  - 🔴 **Failed**: Transaction failed, credits refunded
- **Transaction**: Click to view on Solana explorer

### Refunded Transactions

If a sponsored transaction fails, you'll see:
> "[↩] Refunded gas for failed transaction"

The refunded amount is automatically added back to your balance within 2 minutes.

## Understanding Costs

### Transaction Fees

Transaction fees vary based on:
- Network congestion
- Transaction complexity
- Number of instructions

Typical costs:
- Simple token transfer: ~0.001-0.005 USDC
- Complex smart contract interaction: ~0.01-0.05 USDC

### Settlement Time

- **Pending**: Transaction is being processed (usually seconds)
- **Settled**: Transaction confirmed on Solana (usually within 1-2 minutes)
- **Failed**: Transaction failed or expired (refunded within 2 minutes)

## Troubleshooting

### "Unable to contact gas gateway"

This means the gateway service is temporarily unavailable. You can:
- Wait a moment and try again
- Use SOL for gas fees instead (if you have SOL)
- Check your internet connection

### "Not enough gas credits"

Your balance is too low for the transaction. Options:
- Top up your gas credits
- Use SOL for gas fees instead (if you have SOL)

### "This operation is not supported by gas sponsorship"

Some transaction types cannot be sponsored (e.g., closing accounts, certain program instructions). You'll need to:
- Use SOL for gas fees instead
- Modify the transaction to remove unsupported instructions

### "Transaction blockhash expired"

The transaction's blockhash is too old. Mallory will automatically:
1. Fetch a fresh blockhash
2. Rebuild the transaction
3. Retry the sponsorship

If this happens repeatedly, try again in a moment.

### "Service temporarily unavailable"

The gateway is experiencing issues. You can:
- Wait a few minutes and try again
- Use SOL for gas fees instead (if you have SOL)
- Check the status page (if available)

## Best Practices

1. **Keep a Buffer**: Maintain at least 1-2 USDC in credits to avoid interruptions
2. **Monitor Balance**: Check your balance regularly, especially before large transactions
3. **Enable Notifications**: Get notified when balance is low (if available)
4. **Understand Costs**: Review transaction history to understand typical costs
5. **Use SOL Fallback**: Keep some SOL as backup if gas credits run out

## FAQ

### Do I need SOL to use gas credits?

No! Gas credits are paid with USDC. You only need SOL if you choose to use SOL for gas fees instead.

### What happens if a transaction fails?

If a sponsored transaction fails or expires, your gas credits are automatically refunded within 2 minutes. You'll see a "[↩] Refunded" indicator in your transaction history.

### Can I get a refund of unused credits?

Gas credits are non-refundable, but they never expire. You can use them anytime for future transactions.

### How long do credits last?

Gas credits never expire. Use them whenever you need to make transactions.

### What's the minimum top-up?

The minimum top-up is 0.5 USDC. The maximum is 100 USDC per transaction.

### Can I use gas credits for all transactions?

Most transactions are supported, but some operations (like closing accounts) cannot be sponsored. In those cases, you'll need to use SOL for gas fees.

### How do I disable gasless mode?

Open the Gas Credits screen and toggle **Gasless Mode** to disabled. Your preference is saved automatically.

### Where can I see my transaction history?

Open the Gas Credits screen and scroll down to see your top-up and usage history. Click any transaction to view it on the Solana explorer.

## Support

If you encounter issues or have questions:

- 📧 Email: hello@darkresearch.ai
- 🐛 Issues: [GitHub Issues](https://github.com/darkresearch/mallory/issues)

---

**Note**: Gas credits are a convenience feature. You can always use SOL for transaction fees if you prefer or if gas credits are unavailable.

