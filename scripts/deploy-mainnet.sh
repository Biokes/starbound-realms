#!/bin/bash
set -e

# ── Deploy contracts to Stellar mainnet with safety confirmations ─────────────
# Usage: ./scripts/deploy-mainnet.sh --confirm
# Requires: stellar CLI v26+, cargo, rustup wasm32 target
#
# This script requires explicit confirmation via the --confirm flag and never
# auto-funds accounts. It prints a clear summary before deploying anything.

IDENTITY="${IDENTITY:-mainnet-deployer}"
NETWORK="mainnet"
WASM_DIR="target/wasm32-unknown-unknown/release"
GRID_SIZE="${GRID_SIZE:-16}"

# ── Step 1: Require explicit confirmation ─────────────────────────────────────
if [[ "$1" != "--confirm" ]]; then
  echo "❌ ERROR: This script deploys to mainnet with real funds."
  echo ""
  echo "Usage: ./scripts/deploy-mainnet.sh --confirm"
  echo ""
  echo "The --confirm flag is required to proceed."
  exit 1
fi

echo "🌌 Starbound Realms — Mainnet Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 2: Verify identity exists ────────────────────────────────────────────
if ! stellar keys address "$IDENTITY" &>/dev/null; then
  echo "❌ ERROR: Identity '$IDENTITY' does not exist."
  echo ""
  echo "Create it first with:"
  echo "  stellar keys generate $IDENTITY --network $NETWORK"
  echo ""
  echo "Then fund it manually before running this script."
  exit 1
fi

ADMIN_ADDRESS=$(stellar keys address "$IDENTITY")

# ── Step 3: Print deployment summary ──────────────────────────────────────────
echo "⚠️  MAINNET DEPLOYMENT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Network         : $NETWORK (PUBLIC)"
echo "Identity        : $IDENTITY"
echo "Admin Address   : $ADMIN_ADDRESS"
echo "Grid Size       : ${GRID_SIZE}x${GRID_SIZE}"
echo ""
echo "Contracts to deploy:"
echo "  - galaxy-map"
echo "  - resources"
echo "  - fleet"
echo "  - battle"
echo ""
echo "Assets to deploy:"
echo "  - IRON:$ADMIN_ADDRESS"
echo "  - NRGY:$ADMIN_ADDRESS"
echo "  - PLSM:$ADMIN_ADDRESS"
echo ""
echo "⚠️  WARNING: This will use real XLM from $ADMIN_ADDRESS"
echo "⚠️  WARNING: Deployed contracts cannot be deleted"
echo "⚠️  WARNING: Asset admin will be transferred to the resources contract"
echo ""

# ── Step 4: Final confirmation ────────────────────────────────────────────────
read -p "Type 'DEPLOY' to proceed: " confirmation

if [[ "$confirmation" != "DEPLOY" ]]; then
  echo ""
  echo "❌ Deployment cancelled."
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting deployment..."
echo ""

# ── Step 5: Build contracts ───────────────────────────────────────────────────
echo "🔨 Building contracts..."
cargo build --target wasm32-unknown-unknown --release --quiet
echo "✅ Contracts built"
echo ""

# ── Step 6: Deploy contracts ──────────────────────────────────────────────────
deploy_contract() {
  local name=$1
  local wasm_file=$2

  echo "🚀 Deploying $name..."
  local contract_id
  contract_id=$(stellar contract deploy \
    --wasm "$wasm_file" \
    --source "$IDENTITY" \
    --network "$NETWORK" 2>/dev/null | tail -1)
  echo "✅ $name deployed: $contract_id"
  echo "$contract_id"
}

deploy_asset() {
  local code=$1
  local issuer=$2

  echo "🚀 Deploying $code asset..."
  local contract_id
  contract_id=$(stellar contract asset deploy \
    --asset "$code:$issuer" \
    --source "$IDENTITY" \
    --network "$NETWORK" 2>/dev/null | tail -1)
  echo "✅ $code asset deployed: $contract_id"
  echo "$contract_id"
}

invoke_contract() {
  local contract_id=$1
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source "$IDENTITY" \
    --network "$NETWORK" \
    -- "$@"
}

GALAXY_MAP=$(deploy_contract "galaxy-map" "$WASM_DIR/galaxy_map.wasm")
echo ""
RESOURCES=$(deploy_contract "resources" "$WASM_DIR/resources.wasm")
echo ""
FLEET=$(deploy_contract "fleet" "$WASM_DIR/fleet.wasm")
echo ""
BATTLE=$(deploy_contract "battle" "$WASM_DIR/battle.wasm")
echo ""

ASSET_IRON=$(deploy_asset "IRON" "$ADMIN_ADDRESS")
echo ""
ASSET_ENERGY=$(deploy_asset "NRGY" "$ADMIN_ADDRESS")
echo ""
ASSET_PLASMA=$(deploy_asset "PLSM" "$ADMIN_ADDRESS")
echo ""

# ── Step 7: Initialize contracts ──────────────────────────────────────────────
echo "🔧 Initializing galaxy-map..."
invoke_contract "$GALAXY_MAP" initialize \
  --admin "$ADMIN_ADDRESS" --grid_size "$GRID_SIZE" >/dev/null
echo "✅ galaxy-map initialized"
echo ""

echo "🔧 Initializing resources..."
invoke_contract "$RESOURCES" initialize \
  --admin "$ADMIN_ADDRESS" \
  --iron_token "$ASSET_IRON" --energy_token "$ASSET_ENERGY" --plasma_token "$ASSET_PLASMA" >/dev/null
echo "✅ resources initialized"
echo ""

echo "🔧 Initializing fleet..."
invoke_contract "$FLEET" initialize \
  --admin "$ADMIN_ADDRESS" \
  --resources_contract "$RESOURCES" --galaxy_map_contract "$GALAXY_MAP" >/dev/null
echo "✅ fleet initialized"
echo ""

echo "🔧 Initializing battle..."
invoke_contract "$BATTLE" initialize \
  --admin "$ADMIN_ADDRESS" \
  --galaxy_map_contract "$GALAXY_MAP" --fleet_contract "$FLEET" >/dev/null
echo "✅ battle initialized"
echo ""

# ── Step 8: Register contracts ────────────────────────────────────────────────
echo "🔗 Registering galaxy-map with resources..."
invoke_contract "$RESOURCES" set_galaxy_map \
  --caller "$ADMIN_ADDRESS" --galaxy_map "$GALAXY_MAP" >/dev/null
echo "✅ galaxy-map registered"
echo ""

echo "🔗 Registering battle contract..."
invoke_contract "$FLEET" set_battle_contract \
  --caller "$ADMIN_ADDRESS" --battle_contract "$BATTLE" >/dev/null
invoke_contract "$GALAXY_MAP" set_battle_contract \
  --caller "$ADMIN_ADDRESS" --battle_contract "$BATTLE" >/dev/null
echo "✅ battle contract registered"
echo ""

# ── Step 9: Transfer asset admin ──────────────────────────────────────────────
echo "🔐 Transferring IRON admin to resources contract..."
invoke_contract "$ASSET_IRON" set_admin --new_admin "$RESOURCES" >/dev/null
echo "✅ IRON admin transferred"
echo ""

echo "🔐 Transferring NRGY admin to resources contract..."
invoke_contract "$ASSET_ENERGY" set_admin --new_admin "$RESOURCES" >/dev/null
echo "✅ NRGY admin transferred"
echo ""

echo "🔐 Transferring PLSM admin to resources contract..."
invoke_contract "$ASSET_PLASMA" set_admin --new_admin "$RESOURCES" >/dev/null
echo "✅ PLSM admin transferred"
echo ""

# ── Step 10: Print summary ────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Mainnet deployment complete!"
echo ""
echo "Deployed Contract IDs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "galaxy-map : $GALAXY_MAP"
echo "resources  : $RESOURCES"
echo "fleet      : $FLEET"
echo "battle     : $BATTLE"
echo ""
echo "Deployed Asset IDs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "IRON       : $ASSET_IRON"
echo "NRGY       : $ASSET_ENERGY"
echo "PLSM       : $ASSET_PLASMA"
echo ""
echo "Issuer     : $ADMIN_ADDRESS"
echo "Grid Size  : ${GRID_SIZE}x${GRID_SIZE}"
echo ""
echo "⚠️  IMPORTANT: Save these contract IDs in a secure location!"
echo ""
echo "Update your production .env files with these values:"
echo ""
echo "Backend (.env.production):"
echo "CONTRACT_GALAXY_MAP=$GALAXY_MAP"
echo "CONTRACT_RESOURCES=$RESOURCES"
echo "CONTRACT_FLEET=$FLEET"
echo "CONTRACT_BATTLE=$BATTLE"
echo "ASSET_IRON=$ASSET_IRON"
echo "ASSET_ENERGY=$ASSET_ENERGY"
echo "ASSET_PLASMA=$ASSET_PLASMA"
echo "RESOURCE_ISSUER=$ADMIN_ADDRESS"
echo ""
echo "Frontend (.env.production):"
echo "VITE_CONTRACT_GALAXY_MAP=$GALAXY_MAP"
echo "VITE_CONTRACT_RESOURCES=$RESOURCES"
echo "VITE_CONTRACT_FLEET=$FLEET"
echo "VITE_CONTRACT_BATTLE=$BATTLE"
echo "VITE_RESOURCE_ISSUER=$ADMIN_ADDRESS"
echo ""
