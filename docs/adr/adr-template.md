# ADR-XXX: [Short title of the decision]

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

Describe the issue or question that led to this decision. Include any constraints, background, or context that helps understand why this decision was necessary.

Example:
> We needed to choose a blockchain platform for Starbound Realms. The game requires fast finality (sub-second), low transaction costs (fractions of a cent), and a smart contract platform suitable for real-time gaming logic.

## Decision

State the actual decision that was made. Be concise but clear.

Example:
> We chose Stellar with Soroban smart contracts as the execution layer for Starbound Realms.

## Rationale

Explain *why* this decision was made over alternatives. Consider:
- Technical criteria (performance, security, maintainability)
- Operational criteria (team expertise, ecosystem maturity)
- Business criteria (cost, community, longevity)

Example:
> Stellar offers 5-second finality, sub-cent transaction costs, and Soroban is purpose-built for smart contracts. Alternative platforms (Ethereum, Solana, Polkadot) either had higher fees, longer finality, or immature gaming ecosystems.

## Alternatives Considered

List the alternatives that were rejected, and briefly say why.

Example:
> - **Ethereum Layer 2 (Arbitrum/Optimism)**: Lower cost than L1, but higher than Stellar; larger ecosystem but overkill for a turn-based game.
> - **Solana**: Fast and cheap, but history of network instability and high validator requirements.
> - **Polkadot parachains**: Immature gaming ecosystem; licensing required for a slot.

## Consequences

Describe the downstream effects of this decision — both positive and negative. What becomes easier? What becomes harder? What new problems might arise?

Example:
> **Positive:**
> - Game state is immutable and verifiable on-chain.
> - Players own their resources as real Stellar assets, tradeable on the DEX.
> 
> **Negative:**
> - Smaller ecosystem than Ethereum; fewer libraries and integrations available.
> - Requires players to understand and trust the Stellar network.

## Related Decisions

Link to other ADRs that build on or contradict this one.

Example:
> - [ADR-002: Soroban Smart Contracts](adr-002-soroban-smart-contracts.md)
> - [ADR-003: Stellar Asset Contracts for Resources](adr-003-stellar-asset-contracts-for-resources.md)

## References

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Original GitHub Discussion](#)
