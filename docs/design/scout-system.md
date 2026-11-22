# Design proposal: read-only scouting of a system (#317)

Status: **proposal, for discussion in issue #317.** Nothing here is implemented.

## Problem

Attacking a system means committing a fleet with no prior information about the
defender. `resolve_battle` in `contracts/battle/src/lib.rs` reads the defender's
strength only at the moment the attack lands. A player has no way to check a
system's `defense_rating` or the size of the fleet guarding it before they commit
units.

## Proposed interface

```rust
// contracts/battle/src/lib.rs
pub fn scout_system(env: Env, system_id: u32) -> ScoutReport
```

```rust
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ScoutReport {
    pub system_id: u32,
    pub owner: Option<Address>,
    pub defense_rating: u32,
    pub defender_fleet_defense: u32,
    pub defender_fleet_size: u32,
    pub ledger: u32,
}
```

`defender_fleet_*` is read from the defender's fleet through the fleet contract
(`get_fleet_defense`, plus a unit count from `get_fleet`). `owner` and
`defense_rating` come from the galaxy-map contract (`get_system`).

## Behaviour

1. Read-only. The function reads storage from other contracts and writes
   nothing: no storage, no events, no `require_auth`, and no pause check. It is
   safe to call from a simulation (`simulateTransaction`) and from any client.
2. Unknown `system_id` panics with the same grid-bounds check that
   `resolve_battle` uses.
3. Returns the snapshot as of the current ledger. It does not lock anything, so
   the defender can change the fleet before the attack lands.
4. No cost and no cooldown, because nothing is written. (Open question 1 covers
   whether that should change.)
5. Detectability: a read-only invocation leaves no ledger entry or event. The
   target cannot see that they were scouted. Scouting an enemy system through
   the RPC does not appear on-chain.

## What the design has to face

The honest finding is that most of what `scout_system` would reveal is already
public. `get_system` and `get_fleet` are both read-only and callable by anyone
today. A scouting function therefore adds convenience, not secrecy. Two points
follow from this:

- A player who wants real information asymmetry needs the defender's fleet to
  be hidden, which means a commit-reveal or private-state scheme. That is a
  larger change than this issue and needs its own proposal.
- Without that, scouting is best described as a single-call report that bundles
  data a client could already fetch in two calls.

## Open questions

1. **Cost or cooldown.** If the team wants scouting to be a deliberate choice,
   it has to write something (a cooldown timestamp, a spent-resource burn). That
   makes it a state-changing call, so the "read-only" property and the
   "undetectable" property above no longer hold. Pick one: free and read-only,
   or costly and recorded.
2. **Hidden fleets.** Should defender fleet composition be private until a
   battle? If yes, `scout_system` can only return `defense_rating` and `owner`,
   and the rest needs the commit-reveal design.
3. **Target notification.** If scouting costs something and is recorded, should
   the target see an event? A notification gives defenders a signal, but it also
   reveals the attacker's interest.

## Suggested path

1. Agree on open question 1. This decides the rest.
2. If scouting stays read-only, implement `scout_system` as a view in
   `contracts/battle`, with unit tests for unknown systems and for the report
   contents.
3. Add the `ScoutReport` type to the SDK's battle module so the frontend can
   render it.
