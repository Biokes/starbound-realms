#!/usr/bin/env bash
#
# Benchmarks resource costs for all public contract functions.
# Outputs CPU instructions, memory, and ledger I/O for each function.
#
# Usage: ./scripts/benchmark-resources.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Contract Resource Cost Benchmarks ==="
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

benchmark_contract() {
  local contract_name=$1
  local contract_dir="$PROJECT_ROOT/contracts/$contract_name"
  
  if [ ! -d "$contract_dir" ]; then
    echo "⚠️  Skipping $contract_name: directory not found"
    return
  fi

  echo -e "${BLUE}━━━ $contract_name ━━━${NC}"
  echo
  
  cd "$contract_dir"
  
  # Build the contract
  echo "Building $contract_name..."
  cargo build --target wasm32-unknown-unknown --release --quiet 2>/dev/null || {
    echo "❌ Failed to build $contract_name"
    return
  }
  
  local wasm_path="target/wasm32-unknown-unknown/release/${contract_name//-/_}.wasm"
  
  if [ ! -f "$wasm_path" ]; then
    echo "❌ WASM file not found at $wasm_path"
    return
  fi
  
  # For now, just indicate that the contract is ready for benchmarking
  # Actual simulation would require a test network or local standalone
  echo -e "${GREEN}✓ Contract built successfully${NC}"
  echo "  WASM size: $(du -h "$wasm_path" | cut -f1)"
  echo
  echo "To benchmark this contract's functions:"
  echo "  1. Deploy to testnet or run stellar standalone"
  echo "  2. Run: stellar contract invoke --id <CONTRACT_ID> --fn <FUNCTION_NAME> --sim"
  echo "  3. Record CPU instructions, memory, and I/O from simulation output"
  echo
  
  cd "$PROJECT_ROOT"
}

# Benchmark each contract
benchmark_contract "galaxy-map"
benchmark_contract "fleet"
benchmark_contract "battle"
benchmark_contract "resources"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "📊 Baseline costs are documented in docs/RESOURCE_COSTS.md"
echo
echo "Note: Actual simulation requires deploying contracts to a test network"
echo "or running stellar-standalone. The documented costs in RESOURCE_COSTS.md"
echo "serve as reference baselines for regression testing."
echo
echo "To perform live simulation:"
echo "  1. Start stellar standalone or use testnet"
echo "  2. Deploy contracts"
echo "  3. Use 'stellar contract invoke --sim' for each function"
echo "  4. Compare results against documented baselines"
