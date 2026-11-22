import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ResourceBalances } from './ResourceBalances';

vi.mock('@starbound-realms/sdk', () => ({
  ResourceType: {},
}));
vi.mock('../hooks/useResourceBalances', () => ({
  useResourceBalances: vi.fn(),
}));
vi.mock('../lib/starboundClient', () => ({
  getStarboundClient: vi.fn().mockReturnValue({}),
}));

import { useResourceBalances } from '../hooks/useResourceBalances';

const mockUseResourceBalances = vi.mocked(useResourceBalances);

beforeEach(() => {
  mockUseResourceBalances.mockReset();
});

describe('ResourceBalances', () => {
  it('renders balances for each resource type', async () => {
    mockUseResourceBalances.mockReturnValue({
      balances: { Iron: 120n, Energy: 45n, Plasma: 10n },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ResourceBalances />);
    await waitFor(() => {
      expect(screen.getByText('IRON')).toBeInTheDocument();
      expect(screen.getByText('NRGY')).toBeInTheDocument();
      expect(screen.getByText('PLSM')).toBeInTheDocument();
    });
  });

  it('shows zero balances without crashing', async () => {
    mockUseResourceBalances.mockReturnValue({
      balances: { Iron: 0n, Energy: 0n, Plasma: 0n },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ResourceBalances />);
    await waitFor(() => {
      expect(screen.getByText('IRON')).toBeInTheDocument();
      expect(screen.getByText('NRGY')).toBeInTheDocument();
      expect(screen.getByText('PLSM')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockUseResourceBalances.mockReturnValue({
      balances: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<ResourceBalances />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseResourceBalances.mockReturnValue({
      balances: null,
      loading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    });
    render(<ResourceBalances />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
