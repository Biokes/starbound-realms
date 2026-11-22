import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StarboundClient } from '@starbound-realms/sdk';
import { NetworkIndicator } from './NetworkIndicator';

function clientOn(network: string): StarboundClient {
  return {
    getNetworkInfo: () => ({
      network,
      rpcUrl: 'https://rpc.example.test',
      networkPassphrase: 'passphrase',
    }),
  } as unknown as StarboundClient;
}

describe('NetworkIndicator', () => {
  it('renders nothing when there is no client', () => {
    const { container } = render(<NetworkIndicator client={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows Testnet with the amber testnet styling', () => {
    render(<NetworkIndicator client={clientOn('testnet')} />);

    const badge = screen.getByTestId('network-indicator');
    expect(badge).toHaveTextContent('Testnet');
    expect(badge.className).toContain('bg-amber-100');
    expect(badge.className).not.toContain('bg-green-100');
  });

  it('shows Mainnet with the green mainnet styling', () => {
    render(<NetworkIndicator client={clientOn('mainnet')} />);

    const badge = screen.getByTestId('network-indicator');
    expect(badge).toHaveTextContent('Mainnet');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).not.toContain('bg-amber-100');
  });

  it('shows Unknown with the neutral styling for any other network', () => {
    render(<NetworkIndicator client={clientOn('futurenet')} />);

    const badge = screen.getByTestId('network-indicator');
    expect(badge).toHaveTextContent('Unknown');
    expect(badge.className).toContain('bg-gray-100');
  });
});
