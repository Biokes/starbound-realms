import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMainnetConfirmation } from './useMainnetConfirmation';
import { MAINNET_PASSPHRASE, TESTNET_PASSPHRASE } from '../lib/starboundClient';

describe('useMainnetConfirmation', () => {
  it('signs testnet transactions immediately without confirmation', async () => {
    const mockSignTransaction = vi.fn().mockResolvedValue('SIGNED_XDR');
    const { result } = renderHook(() => useMainnetConfirmation(mockSignTransaction));

    const promise = result.current.signTransactionWithConfirmation(
      'TEST_XDR',
      TESTNET_PASSPHRASE,
      'Test Action'
    );

    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalledWith('TEST_XDR', TESTNET_PASSPHRASE);
    });

    const signedXdr = await promise;
    expect(signedXdr).toBe('SIGNED_XDR');
    expect(result.current.pendingConfirmation).toBeNull();
  });

  it('requires confirmation for mainnet transactions', async () => {
    const mockSignTransaction = vi.fn().mockResolvedValue('SIGNED_XDR');
    const { result } = renderHook(() => useMainnetConfirmation(mockSignTransaction));

    const promise = result.current.signTransactionWithConfirmation(
      'MAINNET_XDR',
      MAINNET_PASSPHRASE,
      'Mainnet Action'
    );

    await waitFor(() => {
      expect(result.current.pendingConfirmation).not.toBeNull();
    });

    expect(result.current.pendingConfirmation).toEqual({
      xdr: 'MAINNET_XDR',
      networkPassphrase: MAINNET_PASSPHRASE,
      action: 'Mainnet Action',
    });

    expect(mockSignTransaction).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmTransaction();
    });

    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalledWith('MAINNET_XDR', MAINNET_PASSPHRASE);
    });

    const signedXdr = await promise;
    expect(signedXdr).toBe('SIGNED_XDR');
    expect(result.current.pendingConfirmation).toBeNull();
  });

  it('cancels mainnet transaction when user cancels', async () => {
    const mockSignTransaction = vi.fn().mockResolvedValue('SIGNED_XDR');
    const { result } = renderHook(() => useMainnetConfirmation(mockSignTransaction));

    const promise = result.current.signTransactionWithConfirmation(
      'MAINNET_XDR',
      MAINNET_PASSPHRASE,
      'Mainnet Action'
    );

    await waitFor(() => {
      expect(result.current.pendingConfirmation).not.toBeNull();
    });

    act(() => {
      result.current.cancelTransaction();
    });

    await expect(promise).rejects.toThrow('Transaction cancelled by user');
    expect(result.current.pendingConfirmation).toBeNull();
    expect(mockSignTransaction).not.toHaveBeenCalled();
  });

  it('handles signing errors after confirmation', async () => {
    const mockSignTransaction = vi.fn().mockRejectedValue(new Error('Signing failed'));
    const { result } = renderHook(() => useMainnetConfirmation(mockSignTransaction));

    const promise = result.current.signTransactionWithConfirmation(
      'MAINNET_XDR',
      MAINNET_PASSPHRASE,
      'Mainnet Action'
    );

    await waitFor(() => {
      expect(result.current.pendingConfirmation).not.toBeNull();
    });

    act(() => {
      result.current.confirmTransaction();
    });

    await expect(promise).rejects.toThrow('Signing failed');
    expect(result.current.pendingConfirmation).toBeNull();
  });

  it('only applies confirmation to mainnet passphrase', async () => {
    const mockSignTransaction = vi.fn().mockResolvedValue('SIGNED_XDR');
    const { result } = renderHook(() => useMainnetConfirmation(mockSignTransaction));

    // Custom network passphrase should not trigger confirmation
    const promise = result.current.signTransactionWithConfirmation(
      'CUSTOM_XDR',
      'Custom Network Passphrase',
      'Custom Action'
    );

    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalledWith('CUSTOM_XDR', 'Custom Network Passphrase');
    });

    const signedXdr = await promise;
    expect(signedXdr).toBe('SIGNED_XDR');
    expect(result.current.pendingConfirmation).toBeNull();
  });
});
