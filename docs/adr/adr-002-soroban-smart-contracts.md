# ADR-002: Soroban as the smart contract execution layer

## Status

Accepted

## Context

After deciding to build on Stellar ([ADR-001](adr-001-stellar-network-choice.md)), the team needed to choose how to execute game logic (combat, resource mechanics, fleet behavior) on-chain.

Stellar Classic (pre-Soroban) supported only limited contract capabilities via SigningKey operations. The ecosystem lacked a mature general-purpose smart contract platform. Soroban was introduced in 2023 as Stellar's native smart contract environment.

The question was: **Should we adopt Soroban, or implement game logic in a custom way outside the smart contract model?**

## Decision

We chose **Soroban** as the primary environment for smart contracts, writing all game logic (galaxy-map, resources, fleet, battle) in Rust compiled to WASM.

## Rationale

### Why Soroban?

1. **Purpose-built for Stellar:** Soroban is not an external virtual machine bolted onto Stellar; it is designed for Stellar's model (async calls, predictable costs, clean auth).
2. **Predictable costs:** Unlike Ethereum where gas can spike unpredictably, Soroban charges based on operations (bandwidth, CPU, memory). Developers can estimate costs with high confidence.
3. **Rust + WASM:** Strong type safety and mature tooling. WASM is portable and auditable.
4. **Official support:** Maintained by the Stellar Development Foundation; guaranteed roadmap and community support.
5. **Mature as of 2024:** By the time Starbound Realms launched, Soroban had been used in production by multiple projects (Stellar Quest, various DeFi protocols).

### Comparison to Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **Soroban** | Official; predictable costs; type-safe; portable | Smaller library ecosystem; fewer reference implementations |
| Custom Stellar Classic ops | Simple; well-known | Limited contract model; hard to express complex logic |
| Off-chain oracle with signed state | Full flexibility | Requires trust in oracle; not fully on-chain |
| Other platforms (Ethereum/Solana) | Mature; large ecosystem | Breaks [ADR-001](adr-001-stellar-network-choice.md); higher costs |

## Consequences

### Positive

- **Full on-chain verification:** Every battle, every resource transfer is verifiable by independent auditors.
- **Language choice:** Rust allows for robust contracts with minimal footprint.
- **Developer velocity:** Soroban SDK abstracts blockchain complexity; developers focus on game logic.
- **Auditability:** WASM is portable and can be audited by external parties.

### Negative

- **Library scarcity:** Some common patterns (proxies, upgradeable contracts) are less mature than on Ethereum.
- **Smaller community:** Fewer third-party tools and libraries compared to Ethereum Solidity.
- **Upgrade path:** Soroban is still evolving; future Stellar upgrades may require contract refactoring.

## Related Decisions

- [ADR-001: Stellar Network Choice](adr-001-stellar-network-choice.md) — Why Stellar
- [ADR-003: Stellar Asset Contracts for Resources](adr-003-stellar-asset-contracts-for-resources.md) — Why SACs for resources vs. game-state tokens

## References

- [Soroban Documentation](https://soroban.stellar.org/)
- [Soroban SDK (Rust)](https://docs.rs/soroban-sdk/)
- [Stellar Docs: Smart Contracts](https://developers.stellar.org/docs/learn/smart-contracts)
- GitHub Issue: [#16 — Contract platform decision](https://github.com/OlaGreat/starbound-realms/issues/16)
