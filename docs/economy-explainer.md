# The Starbound Realms Economy: Resource Sinks and Sources

This document explains where in-game resources (Iron, Energy, Plasma) come from and where they go. Understanding the balance between sources and sinks is key to the game's long-term health.

---

## Resources Overview

Three resources exist, issued as Stellar assets:

| Resource | Symbol | Contract |
|---|---|---|
| Iron | `IRON` | `CDOA5MBXJUGWT6AJL5AUFSO47VVRGUDWG7AQS2VXJ3G6HMRKUBBLMU33` |
| Energy | `NRGY` | `CADVDTZWE2XU6YZZLMDZUDV22DCENAJDTZWAJJUJEHVHR5CJAKZ5WUZF` |
| Plasma | `PLSM` | `CDCUCH2UXBHDASSXN2MTW3L4P3ZDL4UAL2YYFI3RI4A6ARACMMOBU3AD` |

Since they are real Stellar assets, players can:
- Hold them in their Freighter wallet
- Trade on the Stellar DEX
- Send to other players
- Burn to build units (see **Sinks** below)

---

## Sources: Where Resources Come From

### Mining (Primary Source)

**Mechanism:** Players who own a star system can call `resources.mine(system_id)` to harvest that system's yield.

**Yield per system:**
- **Amount:** 10–50 units, randomly generated per system at initialization
- **Frequency:** Once per 300-second period (5 minutes) per owned system
- **Resource type:** Each system produces Iron, Energy, OR Plasma (not mixed)

**Example:** If you own a system with `resource_yield = 50` for Iron:
- After 5 minutes: mine 50 IRON
- After 10 minutes (since last mine): mine 100 IRON
- Partial periods don't reset; leftover time carries forward

**Testnet note:** On testnet, the 8×8 galaxy (64 systems) has an aggregate yield. As players claim systems, they gain access to more yield.

### Admin Mint (Bootstrap Source)

**Mechanism:** The resources contract admin can call `mint(player, resource, amount)` to issue resources.

**Current use:**
- Initial player onboarding (setting up test accounts)
- Faucet-like distributions for testnet gameplay

**After mainnet launch:** This will likely be disabled or rate-limited, since mining becomes the primary inflation mechanism.

---

## Sinks: Where Resources Go

### Unit Building (Primary Sink)

**Mechanism:** Players spend Iron and Energy to build units via `fleet.build_unit(player, unit_type, count)`.

**Cost per unit:**

| Unit | Iron | Energy | Build time | Combat use |
|---|---|---|---|---|
| **Scout** | 10 | 5 | Instant | Weak attack; counters Dreadnoughts |
| **Fighter** | 25 | 15 | Instant | Balanced; counters Scouts |
| **Cruiser** | 60 | 40 | Instant | Strong; counters Fighters |
| **Dreadnought** | 150 | 100 | Instant | Strongest; counters Cruisers |

**Example:** Building a fleet of 1 Scout + 2 Fighters + 1 Cruiser costs:
- Iron: 10 + (2 × 25) + 60 = 120 Iron
- Energy: 5 + (2 × 15) + 40 = 75 Energy

**Unit lifecycle:**
- Once built, units are part of your fleet and can be deployed
- If your fleet loses a battle, units are destroyed (not returned as resources)
- Units never decay; a built unit stays until battle loss

### Plasma (Speculative Future Sink)

**Current state:** Plasma is issued and mineable but has no current sink. It's reserved for future features:
- Advanced unit types
- System upgrades (e.g., increased `defense_rating`)
- Special abilities or cosmetics

---

## Balance: Sources vs. Sinks

### Testnet (8×8 galaxy, 64 systems)

**Current yield potential:**

If all 64 systems are owned and have an average `resource_yield = 30`:
- Total Iron yield per 5-minute cycle: 1,920 units (if 1/3 of systems produce Iron)
- Total Energy yield per 5-minute cycle: 1,920 units
- Total Plasma yield per 5-minute cycle: 1,920 units

**Per player (assuming 64 players, each own 1 system):**
- Yield per 5 minutes: ~30 units of their resource
- Yield per hour: ~360 units
- Yield per day: ~10,368 units

**Spending rate (a player building a fleet):**

A single Dreadnought costs 150 Iron + 100 Energy. If a player mines a system with 50 Iron yield:
- Mining for 1 hour gives 600 Iron
- Enough to build 4 Dreadnoughts + other units

**Equilibrium:** The rate at which players mine matches the rate at which they build units. As more units are built and lost in battles, the game reaches a steady state.

### Mainnet (assumed larger grid)

If mainnet launches with a larger galaxy (e.g., 100×100 = 10,000 systems):
- Supply scales proportionally with the grid size
- Demand (unit building) also scales with player count
- Economic health depends on:
  - Player growth rate
  - Win/loss distribution in battles
  - Admin-minted resource distribution

---

## Economic Mechanics

### Supply Growth

Resources enter the economy through:
1. **Mining:** Unlimited, but capped by system yield and controlled by player ownership distribution
2. **Admin mint:** Controlled, used for onboarding and corrections

Resources leave the economy through:
1. **Burning:** Unit building permanently removes Iron and Energy
2. **Plasma hoarding:** Plasma has no sink yet, so it accumulates

### Redistribution via Battle

When a battle occurs:
- Attacker's units are destroyed (costly loss)
- Defender's units may be destroyed (defensive cost)
- Winner claims the system
- **Economic effect:** No resources are transferred; only fleet composition and system ownership change

**Implications:**
- Winning players accumulate systems → more mining yield → more resource production
- Losing players lose fleets → delayed recovery
- Rich players can afford more unit losses and recover faster

### Trading and DEX

Players can:
- Create peer-to-peer escrow trades in the game
- Trade on the Stellar DEX (off-chain)
- Freely send resources to other players

**Economic effect:** Trading redistributes resources without creating or destroying them (except on minting/burning by the contracts). A DEX enables price discovery and allows players to specialize (e.g., one player focuses on Iron mining, trades for Energy).

---

## Scaling Considerations

As the game grows, the economy must scale:

1. **If too many players:** Supply may not keep up with demand. Result: Resource scarcity, expensive unit building, less new-player onboarding.
   - **Solution:** Increase grid size, increase `resource_yield` per system, or introduce resource sinks.

2. **If too few players:** Supply exceeds demand. Result: Inflation, cheap units, low stakes for holding systems.
   - **Solution:** Introduce new resource sinks (cosmetics, upgrades), reduce mining yield, or allow admin burning.

3. **If battles are rare:** Units accumulate and become cheap. Result: Every player becomes militarily powerful; victory is unclear.
   - **Solution:** Introduce unit decay, maintenance costs, or large-scale seasonal resets (see [seasonal-reset-design.md](seasonal-reset-design.md)).

---

## What's NOT Mined

- **Freighter wallet balance (lumens):** XLM is managed separately; it's the transaction fee currency.
- **System `defense_rating`:** Determined at galaxy initialization; not mineable or buildable (yet).
- **Cooldowns and timers:** Movement cooldown (60s) and mining period (300s) are time-based, not resource-based.

---

## Summary Table: Sources and Sinks

| Flow | Mechanism | Amount | Frequency | Notes |
|---|---|---|---|---|
| **SOURCE: Mining** | `resources.mine()` | 10–50 per system | Every 300s per system | Primary inflation |
| **SOURCE: Admin mint** | `resources.mint()` | Unlimited | As admin chooses | Bootstrap / testnet |
| **SINK: Scout building** | `fleet.build_unit()` | 10 Iron, 5 Energy per unit | Instant, unlimited | Weakest unit |
| **SINK: Fighter building** | `fleet.build_unit()` | 25 Iron, 15 Energy per unit | Instant, unlimited | Balanced unit |
| **SINK: Cruiser building** | `fleet.build_unit()` | 60 Iron, 40 Energy per unit | Instant, unlimited | Strong unit |
| **SINK: Dreadnought building** | `fleet.build_unit()` | 150 Iron, 100 Energy per unit | Instant, unlimited | Strongest unit |
| **SINK: Battle loss** | `battle.resolve_battle()` | Variable units destroyed | Per battle | Indirect deflation via unit loss |
| **NEUTRAL: Trading** | Peer escrow + DEX | No creation/destruction | Player-driven | Redistributes resources |
| **HOARDED: Plasma** | No current sink | Accumulates | Ongoing | Reserved for future features |

---

## Next Steps for Contributors

If you're working on economy features:
- **Plasma sink:** Design and implement system upgrades or advanced units
- **Mining scaling:** How should yield change as the galaxy grows?
- **Battle economy:** Should losers drop resources? Should victories grant rewards?
- **Seasonal resets:** When should the economy reset, and what happens to player assets?

See [seasonal-reset-design.md](seasonal-reset-design.md) for planned reset mechanics.
