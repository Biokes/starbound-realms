import { useState, useCallback } from 'react';
import { MAINNET_PASSPHRASE } from '../lib/starboundClient';

export interface UseMainnetConfirmationResult {
  signTransactionWithConfirmation: (
    xdr: string,
    networkPassphrase: string,
    action: string
  ) => Promise<string>;
  pendingConfirmation: { xdr: string; networkPassphrase: string; action: string } | null;
  confirmTransaction: () => void;
  cancelTransaction: () => void;
}

/**
 * Wraps a signTransaction function to require explicit confirmation before mainnet transactions.
 * Testnet transactions pass through immediately without confirmation.
 */
export function useMainnetConfirmation(
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>
): UseMainnetConfirmationResult {
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    xdr: string;
    networkPassphrase: string;
    action: string;
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
  } | null>(null);

  const signTransactionWithConfirmation = useCallback(
    (xdr: string, networkPassphrase: string, action: string): Promise<string> => {
      // If not mainnet, sign immediately without confirmation
      if (networkPassphrase !== MAINNET_PASSPHRASE) {
        return signTransaction(xdr, networkPassphrase);
      }

      // For mainnet, show confirmation dialog
      return new Promise<string>((resolve, reject) => {
        setPendingConfirmation({
          xdr,
          networkPassphrase,
          action,
          resolve,
          reject,
        });
      });
    },
    [signTransaction]
  );

  const confirmTransaction = useCallback(() => {
    if (!pendingConfirmation) return;

    const { xdr, networkPassphrase, resolve, reject } = pendingConfirmation;
    setPendingConfirmation(null);

    signTransaction(xdr, networkPassphrase)
      .then(resolve)
      .catch(reject);
  }, [pendingConfirmation, signTransaction]);

  const cancelTransaction = useCallback(() => {
    if (!pendingConfirmation) return;

    pendingConfirmation.reject(new Error('Transaction cancelled by user'));
    setPendingConfirmation(null);
  }, [pendingConfirmation]);

  return {
    signTransactionWithConfirmation,
    pendingConfirmation: pendingConfirmation
      ? { xdr: pendingConfirmation.xdr, networkPassphrase: pendingConfirmation.networkPassphrase, action: pendingConfirmation.action }
      : null,
    confirmTransaction,
    cancelTransaction,
  };
}
