# ADR-001: Why Stellar was chosen as the blockchain platform

## Status

Accepted

## Context

Starbound Realms is a fully on-chain, turn-based strategy game where every player action (claiming systems, mining resources, building fleets, resolving battles) must be recorded on a blockchain. The game required:

1. **Fast finality** — Players need to see the outcome of their actions quickly (sub-10 second confirmation).
2. **Low transaction costs** — Gaming should be accessible; $0.01–$0.10 per transaction is acceptable; $1+ per transaction is prohibitive.
3. **Smart contract support** — Complex game logic (fleet combat, resource allocation) must run on-chain.
4. **Native asset support** — In-game resources should be tradeable, real assets that live on a public ledger.

## Decision

We chose **Stellar** as the primary blockchain platform for Starbound Realms, using **Soroban** smart contracts for game logic and native **Stellar Asset Contracts (SACs)** for resource tokens (Iron, Energy, Plasma).

## Rationale

### Why Stellar?

- **Finality:** ~5 seconds (Stellar Consensus Protocol). Fast enough for real-time game feedback without being prohibitively expensive on infrastructure.
- **Cost:** Stellar operations cost less than $0.001 per transaction; payments to players can be near-free.
- **Asset model:** Stellar natively supports custom assets (Classic Assets); new Stellar Asset Contracts (SACs) allow these assets to be administered by smart contracts without custodial trust.
- **Ecosystem:** Freighter (the standard Stellar browser wallet) is well-established; existing Stellar users have the wallet already installed.
- **Developer experience:** Soroban is a purpose-built smart contract platform for Stellar; it offers predictable execution costs, clean auth model, and Rust as the primary language.

### Comparison to Alternatives

| Platform | Finality | Cost per tx | Smart Contracts | Native Assets | Notes |
|----------|----------|-------------|-----------------|---------------|-------|
| **Stellar** | ~5s | <$0.001 | Soroban | ✅ SACs | **Chosen** — best for gaming |
| Ethereum | ~15s | $5–$50 | Mature | ✅ ERC-20 | Too expensive for casual gaming |
| Polygon | ~2s | $0.001–$0.01 | Mature | ✅ ERC-20 | Good cost; centralized validators |
| Solana | ~400ms | <$0.001 | Mature | ✅ SPL | Fast and cheap; history of instability; high validator requirements |
| Algorand | ~4s | <$0.001 | Available | ✅ ASA | Smaller ecosystem; less gaming community |

## Consequences

### Positive

- **Transparent and verifiable:** Every game transaction is on-chain and independently verifiable.
- **Player ownership:** Resources are real Stellar assets; players can hold them in Freighter, trade them on StellarDEX, or send them to others.
- **Low friction:** No bridge fees, no wrapped tokens. A player mines Iron, they own Iron.
- **Community:** Stellar's gaming and open-finance communities are growing; potential for partnerships and cross-game liquidity.

### Negative

- **Smaller ecosystem:** Fewer libraries and integrations than Ethereum. Developers may need to build custom tooling.
- **Network dependency:** Game availability depends on Stellar testnet/mainnet uptime (99.99%+ historically, but not 100%).
- **Adoption barrier:** Players unfamiliar with Stellar may be confused by the wallet setup or asset trust lines.

## Related Decisions

- [ADR-002: Soroban Smart Contracts](adr-002-soroban-smart-contracts.md) — Why Soroban over Stellar Classic contracts
- [ADR-003: Stellar Asset Contracts for Resources](adr-003-stellar-asset-contracts-for-resources.md) — Why SACs over game-state contracts

## References

- [Stellar Documentation](https://developers.stellar.org/)
- [Stellar Consensus Protocol](https://developers.stellar.org/docs/learn/stellar-basics)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Why Stellar?](https://github.com/OlaGreat/starbound-realms/blob/main/docs/WHY_STELLAR_SOROBAN.md)
- GitHub Issue: [#15 — Platform selection](https://github.com/OlaGreat/starbound-realms/issues/15)
