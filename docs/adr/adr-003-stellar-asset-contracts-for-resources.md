# ADR-003: Stellar Asset Contracts for in-game resources

## Status

Accepted

## Context

After deciding on Stellar and Soroban ([ADR-001](adr-001-stellar-network-choice.md), [ADR-002](adr-002-soroban-smart-contracts.md)), the team needed to decide how to represent in-game resources (Iron, Energy, Plasma).

Two main options:

1. **Game-state contracts:** Store all resource balances in a Soroban contract; players query the contract to check balances.
2. **Stellar Asset Contracts (SACs):** Issue Iron, Energy, and Plasma as native Stellar assets, administered by a game contract (but independently transferable on the Stellar network).

## Decision

We chose **Stellar Asset Contracts (SACs)** to issue and administer Iron, Energy, and Plasma as native Stellar assets.

## Rationale

### Why SACs?

1. **Composability:** Resources live on the Stellar network as real assets, not locked inside a game contract. Players can trade them on StellarDEX, transfer them between wallets, or use them in future applications.
2. **Minimal trust:** Players don't need to trust the game contract to hold their resources. Stellar's native asset model ensures they can always withdraw to their wallet.
3. **Standard model:** SACs follow the Stellar asset standard, making integration with wallets and exchanges trivial.
4. **Owned by the game:** The resources contract is the admin of all three asset contracts, so game mechanics (minting, burning) remain under our control.

### Comparison

| Model | Pros | Cons |
|-------|------|------|
| **SACs** | Composable; tradeable off-chain; no bridge; real Stellar assets | Requires SAC setup; players must trust Stellar asset model |
| Game-state contract | Simpler contract; all logic in one place | Locked in game contract; requires bridge to trade; not portable |
| Wrapped tokens (ERC-20 style) | Familiar to Ethereum devs | Defeats the purpose of Stellar; adds custodial risk |

### Comparison to Alternatives

If we used a game-state contract:
- Players could only use Iron within Starbound Realms.
- Trading resources would require complex escrow logic.
- If the game shuts down, resources are stranded.

With SACs:
- Resources are real Stellar assets; they retain value even if Starbound Realms ends.
- Players can trade on StellarDEX freely.
- Resources can be used in future games or applications built on Stellar.

## Consequences

### Positive

- **Player agency:** Players own their resources as real assets, tradeable anywhere.
- **Economic liquidity:** Resources can be pooled on StellarDEX, creating a liquid market.
- **Ecosystem alignment:** Resources follow Stellar's design philosophy (native assets, no wrapping).
- **Future-proof:** If Starbound Realms evolves or merges with other games, resources remain portable.

### Negative

- **Setup complexity:** Players must establish trustlines for each resource before receiving them (one-time, can be automated in UI).
- **On-chain spam risk:** Issuing as native assets means more ledger entries, but Stellar's spam prevention handles this.
- **Admin responsibility:** The game contract must remain the admin of all three asset contracts indefinitely (or transfer admin if the game changes hands).

## Related Decisions

- [ADR-001: Stellar Network Choice](adr-001-stellar-network-choice.md)
- [ADR-002: Soroban Smart Contracts](adr-002-soroban-smart-contracts.md)

## References

- [Stellar Asset Contracts](https://developers.stellar.org/docs/learn/stellar-basics/stellar-asset-contracts)
- [Stellar Documentation: Custom Assets](https://developers.stellar.org/docs/learn/stellar-basics/custom-assets)
- [StellarDEX](https://stellar.expert/explore/public)
- GitHub Issue: [#17 — Resource model decision](https://github.com/OlaGreat/starbound-realms/issues/17)
- Code: [contracts/resources/src/lib.rs](../../../contracts/resources/src/lib.rs)
