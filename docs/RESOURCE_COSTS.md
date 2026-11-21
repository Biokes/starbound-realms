# Contract Resource Cost Benchmarks

This document records baseline resource costs for all public contract functions. These benchmarks help detect when code changes accidentally make operations significantly more expensive.

## How to Run Benchmarks

The `scripts/benchmark-resources.sh` script simulates each public function and records its resource usage:

```bash
./scripts/benchmark-resources.sh
```

This uses `stellar contract invoke --sim` to get resource costs without deploying to a live network.

## Benchmark Results

All costs are measured in Stellar resource units. Costs may vary based on:
- Input data size
- Storage state (first call vs. subsequent calls)
- Network conditions

Last updated: 2024-11-21

---

## Galaxy Map Contract

### `initialize`
- **CPU Instructions**: ~15,000
- **Memory Bytes**: ~5,000
- **Ledger Read Bytes**: 0
- **Ledger Write Bytes**: ~1,500
- **Description**: One-time setup, creates admin storage

### `create_system`
- **CPU Instructions**: ~25,000
- **Memory Bytes**: ~8,000
- **Ledger Read Bytes**: ~500
- **Ledger Write Bytes**: ~2,000
- **Description**: Creates a new star system with default values

### `claim_system`
- **CPU Instructions**: ~30,000
- **Memory Bytes**: ~10,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: ~2,000
- **Description**: Claims an unclaimed system for a player

### `get_system`
- **CPU Instructions**: ~8,000
- **Memory Bytes**: ~3,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: 0
- **Description**: Read-only query for system data

### `upgrade_system`
- **CPU Instructions**: ~35,000
- **Memory Bytes**: ~12,000
- **Ledger Read Bytes**: ~2,500
- **Ledger Write Bytes**: ~2,500
- **Description**: Increases system upgrade level, updates defense

### `transfer_ownership_after_battle`
- **CPU Instructions**: ~20,000
- **Memory Bytes**: ~7,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: ~2,000
- **Description**: Updates system ownership after combat resolution

---

## Fleet Contract

### `initialize`
- **CPU Instructions**: ~15,000
- **Memory Bytes**: ~5,000
- **Ledger Read Bytes**: 0
- **Ledger Write Bytes**: ~1,500
- **Description**: One-time setup, creates admin storage

### `build_fleet`
- **CPU Instructions**: ~40,000
- **Memory Bytes**: ~15,000
- **Ledger Read Bytes**: ~3,000
- **Ledger Write Bytes**: ~3,500
- **Description**: Builds ships, updates fleet composition

### `move_fleet`
- **CPU Instructions**: ~35,000
- **Memory Bytes**: ~12,000
- **Ledger Read Bytes**: ~2,500
- **Ledger Write Bytes**: ~2,500
- **Description**: Moves fleet to adjacent system, validates location

### `get_fleet`
- **CPU Instructions**: ~8,000
- **Memory Bytes**: ~3,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: 0
- **Description**: Read-only query for fleet data

### `apply_battle_losses`
- **CPU Instructions**: ~30,000
- **Memory Bytes**: ~10,000
- **Ledger Read Bytes**: ~2,500
- **Ledger Write Bytes**: ~2,500
- **Description**: Reduces fleet counts after battle

### `repair_fleet`
- **CPU Instructions**: ~25,000
- **Memory Bytes**: ~9,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: ~2,000
- **Description**: Repairs damaged ships using resources

---

## Battle Contract

### `initialize`
- **CPU Instructions**: ~18,000
- **Memory Bytes**: ~6,000
- **Ledger Read Bytes**: 0
- **Ledger Write Bytes**: ~2,000
- **Description**: One-time setup, stores galaxy-map and fleet contract addresses

### `resolve_battle`
- **CPU Instructions**: ~120,000 - ~500,000 (varies by combat rounds)
- **Memory Bytes**: ~50,000 - ~200,000
- **Ledger Read Bytes**: ~6,000
- **Ledger Write Bytes**: ~5,000
- **Description**: Runs combat simulation, high variability due to PRNG rounds
- **Note**: Cost scales with fleet sizes and combat duration (max 20 rounds)

### `propose_pact`
- **CPU Instructions**: ~22,000
- **Memory Bytes**: ~7,000
- **Ledger Read Bytes**: ~1,500
- **Ledger Write Bytes**: ~1,500
- **Description**: Proposes non-aggression pact between players

### `accept_pact`
- **CPU Instructions**: ~25,000
- **Memory Bytes**: ~8,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: ~2,000
- **Description**: Accepts pending pact proposal

### `get_battle`
- **CPU Instructions**: ~8,000
- **Memory Bytes**: ~3,500
- **Ledger Read Bytes**: ~2,500
- **Ledger Write Bytes**: 0
- **Description**: Read-only query for battle result

### `get_pact_status`
- **CPU Instructions**: ~10,000
- **Memory Bytes**: ~4,000
- **Ledger Read Bytes**: ~1,500
- **Ledger Write Bytes**: 0
- **Description**: Read-only query for pact status between two players

### `pause` / `unpause`
- **CPU Instructions**: ~15,000
- **Memory Bytes**: ~5,000
- **Ledger Read Bytes**: ~500
- **Ledger Write Bytes**: ~500
- **Description**: Admin-only emergency controls

---

## Resources Contract

### `initialize`
- **CPU Instructions**: ~15,000
- **Memory Bytes**: ~5,000
- **Ledger Read Bytes**: 0
- **Ledger Write Bytes**: ~1,500
- **Description**: One-time setup, creates admin storage

### `set_rate`
- **CPU Instructions**: ~20,000
- **Memory Bytes**: ~6,000
- **Ledger Read Bytes**: ~500
- **Ledger Write Bytes**: ~1,000
- **Description**: Admin sets production rate for a resource type

### `harvest`
- **CPU Instructions**: ~45,000
- **Memory Bytes**: ~18,000
- **Ledger Read Bytes**: ~4,000
- **Ledger Write Bytes**: ~4,000
- **Description**: Player collects accumulated resources from their systems

### `spend`
- **CPU Instructions**: ~30,000
- **Memory Bytes**: ~12,000
- **Ledger Read Bytes**: ~3,000
- **Ledger Write Bytes**: ~3,000
- **Description**: Deducts resources for building/upgrading

### `get_balance`
- **CPU Instructions**: ~8,000
- **Memory Bytes**: ~3,000
- **Ledger Read Bytes**: ~2,000
- **Ledger Write Bytes**: 0
- **Description**: Read-only query for player's resource balance

### `get_production_rate`
- **CPU Instructions**: ~7,000
- **Memory Bytes**: ~2,500
- **Ledger Read Bytes**: ~1,000
- **Ledger Write Bytes**: 0
- **Description**: Read-only query for resource production rate

---

## Notes on Variability

- **Initialization functions** are called once per contract instance, so their cost is less critical
- **Read-only queries** (`get_*`) have minimal write costs and are generally cheap
- **Combat resolution** (`resolve_battle`) has the highest variability due to random combat rounds
- **Costs increase** with:
  - More storage reads/writes
  - Larger data structures
  - More complex computation (loops, RNG)
  
## Regression Testing

When modifying contract functions, compare new costs against these baselines:
- ✅ Within 10% is acceptable natural variation
- ⚠️ 10-30% increase warrants investigation
- ❌ >30% increase suggests an inefficiency was introduced

Run benchmarks before and after significant changes to catch regressions early.
