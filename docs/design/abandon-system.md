# Design proposal: voluntarily abandon a claimed system (#299)

Status: **proposal, for discussion in issue #299.** Nothing here is implemented.

## Problem

A system can only leave a player's hands by being lost in battle
(`transfer_ownership_after_battle` in `contracts/galaxy-map`). A player who
over-expands, or who wants to consolidate their territory, has no voluntary
exit. They can't release a system without losing it to an attacker.

## Proposed interface

```rust
// contracts/galaxy-map/src/lib.rs
pub fn abandon_system(env: Env, player: Address, system_id: u32)
```

Behaviour:

1. `player.require_auth()`, and the contract is not paused (same guards as
   `claim_system` and `upgrade_system`).
2. The system exists and its owner is `player`. Otherwise panic.
3. The system's owner is set to `None`. The upgrade level and resource yield
   stay as they are, so a later claim does not reset them. (Open question 1.)
4. `last_claimed` is set to the current ledger timestamp. This starts the
   cooldown in Q2.
5. The player's owned-system count is decremented, as `transfer_ownership`
   already does.
6. Publish `("abandoned", player)` with the value `system_id`.

Indexer: a new `processEvent` case for `abandoned` should clear the owner
and decrement the player's owned count. It should mirror the pattern used for
`upgraded` in `backend/src/indexer/processor.ts` (#296).

## Abuse and cooldown

Without a rule, a player can abandon and reclaim a system in a loop. That
spams events and gives a free way to reset `last_claimed`.

Options for the cooldown on **reclaiming an abandoned system**:

- **A. No cooldown.** Simplest. Abuse is possible but has no benefit to the
  attacker, since the system is unowned during the gap.
- **B. Fixed cooldown per system**, for example 100 ledgers, after an abandon
  before anyone can claim it. This stops reclaim loops and gives the abandoning
  player no benefit from the reset.
- **C. Cooldown per player**, for example one abandon per 500 ledgers. This
  limits spam but does not stop a single system from being cycled.

Recommendation: **B**, because it targets the specific abuse, and it is
straightforward to add a `claimable_after` field to `StarSystem` and check it
in `claim_system`.

## Open questions for the issue thread

1. Should an abandoned system keep its upgrade level, or reset to 0? Keeping
   it means upgrades are never fully lost; resetting it makes abandoning a
   cost-free way to shed a maintenance burden.
2. Which cooldown do we agree on: A, B or C above, and what length?
3. Can a player abandon a system that has a fleet deployed on it? Options:
   refuse (recommended), or recall the fleet.
4. Can a system in an active battle be abandoned? Recommendation: no. The
   battle contract should check this, or the abandon should be refused while a
   battle is in progress.

## Acceptance for the implementation (not part of this proposal)

Per CONTRIBUTING: tests first, then the implementation, and a mutation check
on the owner and cooldown conditions.
