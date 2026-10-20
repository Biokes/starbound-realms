# Seasonal Reset Design (proposal)

Status: **proposal, not yet agreed.** This describes how a governance-triggered season reset would work, based on
what the four contracts already do. It is referenced from the "Seasonal resets" entry in
[game-mechanics.md](game-mechanics.md#future-mechanics-open-for-contributors).

---

## What a reset must clear

A reset returns the galaxy to a fresh state for a new season. Each contract holds different state, so each needs
its own reset step.

| Contract | State | Existing reset | Gap |
|---|---|---|---|
| `galaxy-map` | `owner`, `last_claimed` on every `StarSystem` | `reset_season` (admin) clears both on every system | Does **not** clear the per-player system lists (`DataKey::PlayerSystems`), so they go stale. Has no tests. |
| `resources` | `LastMined(id)` per system | `reset_season` (admin) sets `LastMined` to now, so mining restarts without a backlog payout | Token balances live on the Stellar Asset Contracts and are not cleared. `burn` needs the holder's own auth and there is no registry of holders to sweep. |
| `fleet` | `Fleet` and `Deployed` per player | `reset_player_fleet` (admin), one player per call | No registry of players with fleets, so the caller must supply every player. |
| `battle` | `Battle(id)` records, `NextBattleId` | None | Battle history is not reset. Needs a decision (see below). |

---

## Proposal

### 1. Season counter (galaxy-map)

Add `Season: u32` to `galaxy-map` instance storage. `reset_season` increments it. Every other contract reads
the current season from `galaxy-map` when it needs one, the same way it already reads `get_grid_size`.

### 2. Keep battle history, tag it by season (battle)

Battle records are kept as an archive, not deleted. Each `BattleResult` gets a `season` field, set from
`galaxy-map` at resolution time. The leaderboard's "most battles won" then counts the current season only.

### 3. Stale player lists are filtered at read time (galaxy-map)

Rather than sweep every player's `PlayerSystems` list on reset (there is no player registry to loop over),
readers should keep only systems whose current `owner` matches the player. `reset_season` then needs no extra
writes for this, and the stale lists cost nothing until read.

### 4. Fleet reset takes an explicit player list (fleet)

Replace the one-player-per-call reset with `reset_player_fleets(caller, players: Vec<Address>)`, admin only. The
admin script supplies the player list from the backend indexer. This avoids adding an on-chain registry.

### 5. Token balances carry over (resources)

Balances are not cleared. Clearing them would need either holder auth or a sweep over every holder, neither of
which the contracts support. A season therefore keeps each player's resources. If we want a true economic reset,
that is a separate decision, and it would need an off-chain airdrop-style process.

---

## Running a reset

A reset is run by an admin script, not by one transaction. Each contract is a separate transaction, so a run can
stop partway. Each step must be safe to re-run:

1. `galaxy-map.reset_season` (increments the season, clears ownership)
2. `resources.reset_season` (sets `LastMined` to now)
3. `fleet.reset_player_fleets` in batches, for every player the indexer knows about

Re-running a step after a partial failure is safe. Each step sets fixed values, so running it twice gives the same
result.

---

## Unit type matchups (proposed, issue #90)

Implemented in `contracts/battle` as a first step, pending agreement:

- Counter cycle: Scout beats Dreadnought, Dreadnought beats Cruiser, Cruiser beats Fighter, Fighter beats Scout.
- A unit's attack is multiplied by 1.5 when the defender fleet contains its counter type.
- Only attack is modified. Defense is unchanged, so the bonus is one-sided by design, to keep the change minimal.

## Alternatives considered

- **Redeploy the contracts for each season.** Simple, but it loses battle history and every player's
  address-keyed state, and needs a migration for the frontend and indexer. Rejected.
- **On-chain player registry for fleets.** Makes the fleet reset self-contained, but adds storage and a write to
  every first build. Rejected in favour of an admin-supplied list, which the indexer already has.

---

## Open questions

- Should resource balances reset with the season, or carry over? (Proposal above: carry over.)
- Does battle history count toward a season's leaderboard, or only battles fought in it? (Proposal: only in it.)
- How often may a reset run? Proposal: governance-triggered only, never automatic.
