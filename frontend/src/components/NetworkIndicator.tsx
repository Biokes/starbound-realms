/**
 * Network indicator badge (#135).
 *
 * Shows a persistent badge in the header indicating whether the player
 * is connected to Testnet or Mainnet.
 */

import { useState, useEffect } from 'react';
import { StarboundClient } from '@starbound-realms/sdk';

interface NetworkIndicatorProps {
  client: StarboundClient | null;
}

export function NetworkIndicator({ client }: NetworkIndicatorProps) {
  const [networkInfo, setNetworkInfo] = useState<{
    network: string;
  } | null>(null);

  useEffect(() => {
    if (client) {
      const info = client.getNetworkInfo();
      setNetworkInfo(info);
    }
  }, [client]);

  if (!networkInfo) {
    return null;
  }

  const isTestnet = networkInfo.network === 'testnet';
  const isMainnet = networkInfo.network === 'mainnet';

  return (
    <div
      data-testid="network-indicator"
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold
        ${isTestnet
          ? 'bg-amber-100 text-amber-800 border border-amber-200'
          : isMainnet
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }
      `}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isTestnet
            ? 'bg-amber-500'
            : isMainnet
              ? 'bg-green-500'
              : 'bg-gray-500'
        }`}
      />
      {isTestnet ? 'Testnet' : isMainnet ? 'Mainnet' : 'Unknown'}
    </div>
  );
}

export default NetworkIndicator;
