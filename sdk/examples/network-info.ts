/**
 * `StarboundClient.getNetworkInfo` example for `@starbound-realms/sdk`.
 *
 * Shows which network a client is pointed at, then performs one read-only
 * call (`GalaxyClient.getGridSize`) to confirm the RPC endpoint reported by
 * `getNetworkInfo` is reachable and the galaxy-map contract answers. No
 * account, keypair, or funding is required.
 *
 * Usage (from repo root):
 *   pnpm --dir sdk build
 *   node sdk/examples/network-info.ts
 *
 * Optional environment variables:
 *   CONTRACT_GALAXY_MAP, CONTRACT_RESOURCES, CONTRACT_FLEET, CONTRACT_BATTLE
 *     Override the contract IDs (defaults come from `.env.testnet`).
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StarboundClient, GalaxyClient } from '../dist/index.js';

function loadTestnetEnv(): Record<string, string> {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env.testnet');
  const vars: Record<string, string> = {};
  if (!existsSync(envPath)) return vars;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const env = loadTestnetEnv();
const contractId = (key: string): string => {
  const value = process.env[key] ?? env[key];
  if (!value) throw new Error(`${key} is not set (expected in .env.testnet or the environment)`);
  return value;
};

async function main(): Promise<void> {
  const client = StarboundClient.testnet({
    galaxyMap: contractId('CONTRACT_GALAXY_MAP'),
    resources: contractId('CONTRACT_RESOURCES'),
    fleet: contractId('CONTRACT_FLEET'),
    battle: contractId('CONTRACT_BATTLE'),
  });

  // getNetworkInfo is synchronous and makes no network request.
  const info = client.getNetworkInfo();
  console.log('Network:            ', info.network); // 'testnet' | 'mainnet' | 'unknown'
  console.log('RPC URL:            ', info.rpcUrl);
  console.log('Network passphrase: ', info.networkPassphrase);

  // Guard against accidentally running a script against the wrong network.
  if (info.network !== 'testnet') {
    throw new Error(`Expected a testnet client, got "${info.network}"`);
  }

  // Prove the reported RPC endpoint is live with a read-only call.
  const gridSize = await new GalaxyClient(client).getGridSize();
  console.log(`Connected — galaxy grid is ${gridSize}x${gridSize}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
