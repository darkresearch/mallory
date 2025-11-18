---
"@darkresearch/mallory-client": minor
"@darkresearch/mallory-server": minor
---

Add x402 gas abstraction feature with balance caching, top-up, and transaction sponsorship

- Implement wallet authentication generator for gateway authentication
- Add x402 gas abstraction service with balance query, top-up, and transaction sponsorship
- Add client-side gas abstraction context with 10-second balance caching
- Implement gas abstraction screen UI with balance display, top-up flow, and transaction history
- Add developer API for agents (GasSponsorClient)
- Integrate gasless mode for AI tool transactions and SendModal
- Add comprehensive test coverage (unit, integration, and E2E tests)
- Add telemetry logging for gas abstraction operations
- Support graceful degradation with SOL fallback
