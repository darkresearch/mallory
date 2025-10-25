import { useWallet } from '../contexts/WalletContext';
import { WalletData } from '../features/wallet';

export interface UseWalletDataReturn {
  walletData: WalletData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Legacy hook for backward compatibility.
 * Now simply wraps the useWallet context hook.
 * Wallet data is loaded in the background by WalletProvider.
 */
export function useWalletData(): UseWalletDataReturn {
  const { walletData, isLoading, isRefreshing, error, refreshWalletData, clearError } = useWallet();

  return {
    walletData,
    isLoading,
    isRefreshing,
    error,
    refresh: refreshWalletData,
    clearError
  };
}
