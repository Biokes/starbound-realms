# Glossary — Stellar / Soroban Terms

The docs and codebase use Stellar- and Soroban-specific vocabulary that is rarely defined where it
appears. This page collects those terms in one place. Each entry is a one- or two-sentence
summary; follow the link for the official, in-depth documentation.

New to Stellar but not new to blockchain? Start with [Account](#account),
[Trustline](#trustline), [SAC](#sac-stellar-asset-contract), and [Soroban RPC](#soroban-rpc).

---

## Account

A Stellar public key pair (the `G...` address you see in the game) that can hold balances, sign
transactions, and own trustlines. Every player, issuer, and admin in Starbound Realms is an
account. See [Accounts](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts).

## Admin (asset admin)

The account or contract authorized to control a token — most importantly to **mint** new supply.
In Starbound Realms the `resources` contract is the admin of the `IRON`, `NRGY`, and `PLSM` token
contracts, so it can mint for mining and for the admin-only `mint` function without any other
signature. See [Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract).

## Asset issuer

The account that created a classic asset and is ultimately responsible for it. The issuer of the
in-game resources is fixed at deployment; players hold balances issued by it. See
[Assets](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets).

## ChangeTrust

The classic transaction operation that creates, modifies, or removes a **trustline** — the SDK's
`establishTrustlines` submits one `ChangeTrust` operation per missing asset in a single
transaction. See [List of operations](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations).

## Classic asset

An asset issued directly on the Stellar ledger (as opposed to a Soroban-native token). The
in-game resources — `IRON`, `NRGY`, `PLSM` — are classic assets wrapped by a
[SAC](#sac-stellar-asset-contract), which is why players need
[trustlines](#trustline) before they can receive them. See
[Assets](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets).

## Contract event

A message a Soroban contract publishes during execution (e.g. `resources_mined`,
`battle_resolved`). The backend indexer polls for these events and mirrors them into PostgreSQL.
See [Events](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/events).

## Contract ID

The `C...` address of a deployed Soroban contract. Each of the four game contracts has one; they
are configured in `.env` as `CONTRACT_GALAXY_MAP`, `CONTRACT_RESOURCES`, etc. See
[Contracts](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/contracts).

## Cross-contract call

One contract invoking a function on another contract during its own execution — the way
`resources.mine` queries `galaxy-map` for system ownership. Contracts never share storage
directly; all interaction is via these calls. See
[Cross-contract invocations](https://developers.stellar.org/docs/learn/fundamentals/contract-development/contract-interactions/cross-contract).

## DEX

Stellar's built-in decentralized exchange — an order book native to the ledger. Because the
resource tokens are classic assets, players can trade `IRON`, `NRGY`, and `PLSM` on the DEX
without any extra infrastructure. See
[DEX liquidity](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools).

## Freighter

The browser wallet extension players use to connect and sign. It holds private keys, so the
frontend never sees them — Freighter signs the XDR the SDK builds and returns it. See
[Freighter guides](https://developers.stellar.org/docs/build/guides/freighter).

## getLedgerEntries

A Soroban RPC method that reads raw ledger entries in one round trip. The SDK's
`findMissingTrustlines` uses it to check all three resource trustlines in a single request
instead of three. See
[getLedgerEntries](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getLedgerEntries).

## Ledger

Stellar's append-only database — every account, balance, and trustline lives in it, updated in
discrete ledger closes (roughly every 5 seconds). Contract storage, resource balances, and
`last_claimed` timestamps are all ledger state. See
[Ledgers](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/ledgers).

## Ledger sequence

A ledger's monotonically increasing number (`1, 2, 3, …`). Soroban's
[Prng](#prng) is seeded partly by the ledger sequence, and the game's `last_claimed` /
`last_mined` values are timestamps recorded against it. See
[Ledgers](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/ledgers).

## Mainnet / Testnet

The two Stellar networks: **mainnet** holds real value; **testnet** is SDF's free playground
network, where Starbound Realms is currently deployed (network passphrase
`Test SDF Network ; September 2015`). Testnet tokens have no monetary value. See
[Networks](https://developers.stellar.org/docs/networks).

## Mint

Creating new token supply. Two paths exist in this repo: the player-facing `resources.mine`
(which mints the system's yield) and the admin-only `resources.mint` (seeding test environments
or manual corrections) — both work because the `resources` contract is the token's
[admin](#admin-asset-admin). See
[Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract).

## Network passphrase

The unique identifier string that distinguishes one Stellar network from another (mainnet,
testnet, future networks). A transaction signed for one network is invalid on any other —
that's why `STELLAR_NETWORK_PASSPHRASE` appears in both `.env` files. See
[Networks](https://developers.stellar.org/docs/networks).

## Operation

A single action inside a classic Stellar transaction — a payment, a `ChangeTrust`, a
manage-offer, etc. One transaction can batch several operations (the trustline setup batches up
to three `ChangeTrust` operations). See
[Operations and transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions).

## Prng

Soroban's built-in pseudo-random number generator. It is seeded per ledger (plus the contract
address), so battle outcomes are deterministic for the same inputs and independently verifiable —
players can't game the randomness by timing transactions. See
[Environment concepts](https://developers.stellar.org/docs/learn/fundamentals/contract-development/environment-concepts).

## require_auth

The Soroban host call that enforces authorization: `admin.require_auth()` aborts the call unless
`admin` actually signed (or is otherwise authorized for) the invocation. It is how every
state-changing game function proves who is calling. See
[Contract authorization](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization).

## SAC (Stellar Asset Contract)

A built-in Soroban contract that wraps a classic asset, giving it a `C...` address and a
token-style interface (`mint`, `burn`, `transfer`, `balance`). `IRON`, `NRGY`, and `PLSM` are
each backed by a SAC whose admin is the `resources` contract. See
[Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract).

## Simulate vs. submit

Two distinct Soroban RPC steps. **Simulation** (`simulateTransaction`) executes a transaction
against local network state without writing anything — the SDK uses it for read calls and to
preflight writes, surfacing contract panics before any fee is spent. **Submission**
(`sendTransaction`) broadcasts a signed transaction to be included in a ledger. See
[Transaction simulation](https://developers.stellar.org/docs/learn/fundamentals/contract-development/contract-interactions/transaction-simulation)
and [sendTransaction](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/sendTransaction).

## Soroban

Stellar's smart-contract platform — deterministic Rust contracts compiled to WASM and executed
in a sandboxed host. All authoritative game state in Starbound Realms lives in four Soroban
contracts. See [Soroban smart contracts](https://developers.stellar.org/docs/smart-contracts).

## Soroban RPC

The HTTP API layer between clients and the Stellar network for contract work: it simulates and
submits transactions, streams events, and reads ledger entries. The backend indexer polls it for
events; the SDK calls it for every read and write. See
[RPC methods](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods).

## Storage (instance / persistent / temporary)

The three classes of Soroban contract storage, differing in cost and lifespan: **instance** for
global config (admin, token addresses), **persistent** for long-lived game state (mining timers,
fleets), **temporary** for short-lived data. Entries can be archived if left untouched long
enough. See [Contract storage](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage).

## Stellar

The L1 blockchain Starbound Realms settles on — fast, low-fee transactions and a native asset
model. See the [Stellar documentation glossary](https://developers.stellar.org/docs/learn/glossary)
for the broader vocabulary.

## Stellar SDK

The official JavaScript/TypeScript library (`@stellar/stellar-sdk`) for building, signing, and
parsing Stellar transactions and XDR. The repo's own TypeScript SDK (`sdk/`) wraps it — see the
[sdk README](https://github.com/OlaGreat/starbound-realms/blob/main/sdk/README.md) for the pinned
version requirement.

## Transaction

An atomic, signed unit of work on the network. Classic transactions carry operations like
payments and `ChangeTrust`; Soroban transactions invoke contract functions. Either way the
payload is serialized as [XDR](#xdr) before signing. See
[Transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions).

## Trustline

An explicit opt-in on a Stellar account for one specific classic asset — without it, the account
simply cannot hold that asset, and a mint to it fails with `"trustline entry is missing"`. Every
player must establish trustlines for `IRON`, `NRGY`, and `PLSM` once before mining; the SDK's
`establishTrustlines` does this in a single signed transaction. See
[Verifying trustlines](https://developers.stellar.org/docs/build/guides/basics/verify-trustlines).

## WASM

WebAssembly — the portable binary format Soroban contracts are compiled to
(`wasm32-unknown-unknown`) before upload and deployment on-chain. The CI workflow builds all
four contracts to WASM on every push. See
[Uploading WASM bytecode](https://developers.stellar.org/docs/build/guides/transactions/upload-wasm-bytecode).

## XDR

External Data Representation — the binary serialization format every Stellar object uses:
transactions, ledger entries, ledger keys, and signatures are all XDR. The SDK builds an XDR
transaction, Freighter signs that XDR, and the result is submitted to the network; the Stellar
SDK types this as `xdr.*` (e.g. `xdr.LedgerKey`). See
[XDR](https://developers.stellar.org/docs/learn/fundamentals/data-format/xdr).

---

## See also

- [`docs/architecture.md`](architecture.md) — where these terms appear in the system design
- [`docs/game-mechanics.md`](game-mechanics.md) — where these terms appear in gameplay rules
- [Official Stellar docs](https://developers.stellar.org/docs) — full reference
