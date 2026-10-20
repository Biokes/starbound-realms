#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
IDENTITY="${1:-test-player-$(date +%s)}"

if stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  echo "Identity '$IDENTITY' already exists; choose another name." >&2
  exit 1
fi

stellar keys generate "$IDENTITY" --network "$NETWORK"
stellar keys fund "$IDENTITY" --network "$NETWORK"
PUBLIC_KEY=$(stellar keys address "$IDENTITY")
SECRET_KEY=$(stellar keys secret "$IDENTITY")
BALANCE=$(stellar account show "$IDENTITY" --network "$NETWORK" 2>/dev/null || echo "unavailable")
echo "Testnet player ready"
echo "Identity: $IDENTITY"
echo "Public key: $PUBLIC_KEY"
echo "Secret key: $SECRET_KEY"
echo "Funded account details:"
echo "$BALANCE"
