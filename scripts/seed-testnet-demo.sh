#!/usr/bin/env bash
# Seeds an already-deployed testnet galaxy with demo state (#297):
# three demo players claim systems, mine them, build fleets and fight a battle
# or two, so the UI and the wave demo start from a non-empty galaxy.
#
# Usage:   bash scripts/seed-testnet-demo.sh
# Needs:   stellar CLI, and a completed `scripts/setup-testnet.sh` run
#          (contract IDs are read from scripts/.deploy-state).
# Mirrors the identity pattern in scripts/create-test-player.sh.
#
# Best effort: each step is logged as ok or failed and the script continues,
# because a re-run finds some systems already claimed. It never prints secret
# keys. Re-running is safe: existing identities are reused.
set -uo pipefail

NETWORK="${NETWORK:-testnet}"
STATE_FILE="scripts/.deploy-state"
PLAYERS=(demo-alpha demo-beta demo-gamma)

if [[ ! -f "$STATE_FILE" ]]; then
  echo "missing $STATE_FILE: run scripts/setup-testnet.sh first" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

failures=0

step() { printf '  %-6s %s\n' "$1" "$2"; }

ensure_identity() {
  local name=$1
  if stellar keys address "$name" >/dev/null 2>&1; then
    step "reuse" "identity $name"
  else
    stellar keys generate "$name" --network "$NETWORK" >/dev/null 2>&1 \
      && stellar keys fund "$name" --network "$NETWORK" >/dev/null 2>&1 \
      && step "ok" "created and funded $name" \
      || { step "FAILED" "could not create $name"; failures=$((failures + 1)); }
  fi
}

# invoke <source identity> <contract id> <label> <function> [args...]
invoke() {
  local source=$1 contract=$2 label=$3
  shift 3
  if stellar contract invoke --id "$contract" --source "$source" --network "$NETWORK" -- "$@" >/dev/null 2>&1; then
    step "ok" "$label"
  else
    step "FAILED" "$label"
    failures=$((failures + 1))
  fi
}

address_of() { stellar keys address "$1"; }

echo "Seeding demo galaxy on $NETWORK"

echo "1. Identities"
for p in "${PLAYERS[@]}"; do ensure_identity "$p"; done

echo "2. Claim systems (8x8 grid, ids 0-63)"
# Each player claims a small, spread-out set so the map looks varied.
declare -A CLAIMS=(
  [demo-alpha]="0 1 9"
  [demo-beta]="8 13 30 31"
  [demo-gamma]="20 21 45"
)
for p in "${PLAYERS[@]}"; do
  addr=$(address_of "$p")
  for sys in ${CLAIMS[$p]}; do
    invoke "$p" "$GALAXY_MAP" "claim system $sys for $p" claim_system --player "$addr" --system_id "$sys"
  done
done

echo "3. Mine owned systems"
for p in "${PLAYERS[@]}"; do
  addr=$(address_of "$p")
  for sys in ${CLAIMS[$p]}; do
    invoke "$p" "$RESOURCES" "mine system $sys for $p" mine --player "$addr" --system_id "$sys"
  done
done

echo "4. Build fleets (varied mix per player)"
invoke demo-alpha "$FLEET" "demo-alpha builds 4 Scouts" build_unit --player "$(address_of demo-alpha)" --unit_type '"Scout"' --count 4
invoke demo-alpha "$FLEET" "demo-alpha builds 2 Cruisers" build_unit --player "$(address_of demo-alpha)" --unit_type '"Cruiser"' --count 2
invoke demo-beta "$FLEET" "demo-beta builds 6 Fighters" build_unit --player "$(address_of demo-beta)" --unit_type '"Fighter"' --count 6
invoke demo-gamma "$FLEET" "demo-gamma builds 3 Dreadnoughts" build_unit --player "$(address_of demo-gamma)" --unit_type '"Dreadnought"' --count 3

echo "5. Battles (attacker must own a non-empty fleet; defender owns the system)"
invoke demo-alpha "$BATTLE" "demo-alpha attacks demo-beta at system 8" resolve_battle \
  --attacker "$(address_of demo-alpha)" --defender "$(address_of demo-beta)" --system_id 8
invoke demo-gamma "$BATTLE" "demo-gamma attacks demo-alpha at system 0" resolve_battle \
  --attacker "$(address_of demo-gamma)" --defender "$(address_of demo-alpha)" --system_id 0

echo
if [[ $failures -eq 0 ]]; then
  echo "Demo galaxy seeded with no failed steps."
else
  echo "Demo galaxy seeded with $failures failed step(s). Re-run is safe; check the lines marked FAILED."
  exit 1
fi
