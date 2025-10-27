# Maestro E2E Testing for Mallory (Web Only)

## Quick Start

1. **Install Maestro CLI:**
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Start your local dev server:**
   ```bash
   bun run web  # Make sure app is running on localhost:19006
   ```

3. **Login manually in browser:**
   - Open http://localhost:19006
   - Login with your test account
   - Ensure you have Grid wallet set up with funds

4. **Run Maestro test:**
   ```bash
   bun run maestro:test
   ```

## What It Tests

**x402-payment-flow.yaml** - The critical path that's currently broken:

1. Assumes you're already logged in ✓
2. Creates new chat conversation
3. Asks: "What tokens are smart money buying on Solana?"
4. Waits for x402 payment to process
5. Verifies AI response completes (doesn't stop mid-stream)
6. Verifies response contains actual data

**Expected behavior:**
- Payment auto-approves (0.001 USDC)
- Nansen API called successfully
- AI completes response with data

**Failure indicators (current bug):**
- Response stops streaming mid-sentence
- No data returned
- May show Grid account error in console

## Adjusting Selectors

If Maestro can't find elements, use **Maestro Studio** to record the correct flow:

```bash
bun run maestro:studio
```

This opens a visual editor where you can click through the flow and it generates the YAML for you.

## Tips

- Keep browser window visible during test (Maestro needs to interact with it)
- Don't interact with browser while test is running
- Check browser console for detailed x402 logs if test fails

