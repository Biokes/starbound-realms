# Release Process

This document describes how maintainers prepare, test, tag, deploy, and verify a Starbound Realms release.

## 1. Roles

Only authorized maintainers may:

- Merge release changes into `main`
- Create release tags
- Deploy contracts
- Transfer contract or asset administration
- Publish production frontend/backend deployments
- Pause or upgrade live contracts

Contract, asset, and mainnet administration credentials must never be committed to Git or CI secrets.

---

## 2. Release Types

### Testnet release

Use for routine contract, SDK, frontend, or backend deployments.

- Contract IDs may change when contracts are redeployed.
- Testnet lumens have no value.
- Existing testnet state may be lost during network resets.
- Testnet deployments may use the existing contracts when source changes do not require redeployment.

### Mainnet release

A mainnet release is irreversible and may involve real XLM and permanent contract state.

Use the [mainnet migration checklist](docs/mainnet-migration-plan.md) and require explicit maintainer approval before proceeding.

---

## 3. Before Starting

Create a release branch from the latest `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c release/<version>
