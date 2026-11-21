# Design Proposal: Star System Upgrade Mechanic

**Status:** Proposed / Accepted  
**Issue:** #83  
**Authors:** Starbound Realms Contributors  

---

## 1. Overview & Motivation

Star systems currently have static `resource_yield` and `defense_rating` assigned during galaxy initialization. As players expand their domain and accumulate resources—particularly **Plasma**—they need strategic sinks that reward investment in key territories.

The **System Upgrade Mechanic** allows players to spend mined resources to permanently enhance the defensive capabilities and economic output of star systems they own.

---

## 2. Upgrade Dimensions

Each star system tracks an integer `upgrade_level: u32` (defaulting to `0` for un-upgraded systems).

Upgrading a system provides the following compounding benefits:
1. **Defense Rating Boost:**
   $$\text{defense\_rating}_{\text{effective}} = \text{defense\_rating}_{\text{base}} + (2 \times \text{upgrade\_level})$$
   Enhances defender fleet resilience in battle resolutions.
2. **Resource Yield Multiplication:**
   $$\text{resource\_yield}_{\text{effective}} = \text{resource\_yield}_{\text{base}} + (5 \times \text{upgrade\_level})$$
   Increases raw yield produced during mining cycles.
3. **Visual & Strategic Recognition:**
   Higher upgrade levels appear on the galaxy map with distinguished tier indicators (e.g. Outpost, Citadel, Bastion).

---

## 3. Cost Model & Currency

- **Resource Spent:** Plasma (`PLSM`) is the primary high-tech catalyst.
- **Cost Scaling:**
  $$\text{Cost}(\text{level}) = 100 \times (\text{current\_level} + 1)\ \text{units of Plasma}$$
  - Level 0 → 1: 100 Plasma
  - Level 1 → 2: 200 Plasma
  - Level 2 → 3: 300 Plasma
  - Max Level: 5 (Cap prevents runaway resource dominance)

---

## 4. Execution Model

- **Transaction Execution:** Instant on-chain state transition via `galaxy-map.upgrade_system(player, system_id)`.
- **Authorization:** Only the verified `owner` of the system may initiate an upgrade (`player.require_auth()`).
- **Cooldown / Locks:** A system undergoing battle or transfer cannot be upgraded simultaneously.

---

## 5. Storage & Contract Interface

### Struct Definition
```rust
#[contracttype]
#[derive(Clone, Debug)]
pub struct StarSystem {
    pub owner: Option<Address>,
    pub coord_x: u32,
    pub coord_y: u32,
    pub resource_type: ResourceType,
    pub resource_yield: u32,
    pub defense_rating: u32,
    pub last_claimed: u64,
    pub upgrade_level: u32,
}
```

### Contract Methods
```rust
pub fn upgrade_system(env: Env, player: Address, system_id: u32);
```

### Events Emitted
```rust
env.events().publish(
    (symbol_short!("upgraded"), player),
    (system_id, next_level, cost)
);
```

---

## 6. Migration Plan for Existing Galaxy Deployments

- All systems created during galaxy initialization default to `upgrade_level = 0`.
- Existing persistent storage entries for `StarSystem` on deployed testnets that were initialized prior to `upgrade_level` are deserialized with default fallback `0`.
- No forced state wipe or breaking reset required.
