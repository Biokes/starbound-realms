# Design proposal: unit upkeep as an ongoing resource sink (#291)

Status: **proposal, for discussion in issue #291.** The rates below already
match the code (see "Current state"). The non-payment rule is not implemented.

## Problem

Units cost Iron and Energy once, at build time. After that they cost nothing to
keep, so a player can stockpile a large fleet indefinitely. Upkeep gives Energy
a steady drain, so a large fleet has to be paid for over time.

## Current state

- `contracts/fleet` `calculate_fleet_upkeep` charges Energy per period:
  Scout 1, Fighter 2, Cruiser 5, Dreadnought 12. The SDK `getUnitUpkeep`
  returns the same values.
- `deduct_upkeep(player)` burns the fleet's upkeep through the resources
  contract. If the player's Energy balance is too low, the burn panics and the
  whole call reverts. The fleet is left intact, and nothing else happens.
- So today there is **no** non-payment outcome. The player simply cannot run
  the deduction until they top up Energy.

## Proposed upkeep rates

Rates are Energy per unit per period. Each one is set against that unit's build
Energy cost, so the upkeep is a fixed share of what the unit cost to build:

| Unit | Build cost (Iron / Energy) | Upkeep (Energy / period) | Upkeep as share of build Energy |
|---|---|---|---|
| Scout | 10 / 5 | 1 | 20% |
| Fighter | 25 / 15 | 2 | ~13% |
| Cruiser | 60 / 40 | 5 | 12.5% |
| Dreadnought | 150 / 100 | 12 | 12% |

**Recommendation:** keep these values. Cheap units are upkept at a higher
share of their build cost, so a fleet of Scouts is not a free way to hold
numbers. Dreadnought upkeep is the largest in absolute terms.

## Where it lives: fleet, not resources

**Recommendation: fleet.** Upkeep is calculated from unit counts, and the fleet
contract owns those counts. Keeping the calculation there means no cross-contract
read is needed to price a fleet. The resources contract only holds balances and
burns them, which is the same split used for build costs. This is already how
the code is organised (#293).

## Non-payment: forced disband vs. grace period

Three options:

- **A. Revert only (current).** The player must top up. No penalty, but no
  pressure to keep paying either. A player who stops paying keeps the fleet
  forever at no cost, so the sink does nothing.
- **B. Immediate forced disband.** Units the player cannot cover are removed in
  the same call. Simple, but one missed period, for example a short gap in
  Energy income, destroys units.
- **C. Grace period, then disband.** A short unpaid streak is tolerated.
  Only after `N` consecutive unpaid periods are units removed.

**Recommendation: C**, with `N = 3` periods. It stops a single missed period
from destroying a fleet, and it still stops free holding. Proposed behaviour:

1. `deduct_upkeep` pays in full if it can. The unpaid streak resets to 0.
2. If the balance is short, the call does not revert. It records one more
   unpaid period for the player, and the fleet is kept.
3. When the unpaid streak reaches `N`, the fleet disbands just enough units to
   bring upkeep down to the player's Energy balance. Units with the highest
   upkeep go first (Dreadnought, then Cruiser, Fighter, Scout), so the largest
   sink is removed first.
4. Emit an event for each non-payment and for each disband, so the indexer and
   the UI can warn the player before units are lost.

Option C changes `deduct_upkeep` from a revert to a state change, so it needs
its own tests (see below).

## Open questions for the issue thread

1. Is `N = 3` periods the right grace length? The length of one period is
   still to be chosen.
2. Disband order: highest upkeep first (recommended), or the player picks which
   units go?
3. Should a unit in an active battle or a move be exempt from disband?
4. Is the rate table final, or should upkeep scale with the system's upgrade
   level?

## Impact on existing behaviour

- `deduct_upkeep` changes from reverting on a short balance to recording an
  unpaid period. Callers that rely on the revert need updating.
- The `upkeep` event is kept. New events for non-payment and disband are added.
- No change to build costs or to `get_fleet_upkeep`.

## Acceptance for the implementation (not part of this proposal)

Per CONTRIBUTING: tests first, then the implementation, and a mutation check on
the grace counter and the disband threshold. The tests should cover: a full
payment resets the streak; a short balance records one unpaid period and keeps
the fleet; the disband happens at exactly `N` periods and removes only what is
needed; the disband order follows upkeep.
