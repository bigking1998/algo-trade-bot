import { useState, useEffect, useCallback } from 'react';

interface PhantomProvider {
  isPhantom: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: any): Promise<any>;
  signAllTransactions(transactions: any[]): Promise<any[]>;
  on?: (event: string, callback: (data?: any) => void) => void;
  off?: (event: string, callback: (data?: any) => void) => void;
}

interface WalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  error: string | null;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

export function usePhantomWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    connecting: false,
    publicKey: null,
    error: null,
  });

  // Check if Phantom is installed
  const isPhantomInstalled = useCallback(() => {
    return !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
  }, []);

  // Get the Phantom provider
  const getProvider = useCallback((): PhantomProvider | null => {
    if (window.phantom?.solana?.isPhantom) {
      return window.phantom.solana;
    }
    if (window.solana?.isPhantom) {
      return window.solana;
    }
    return null;
  }, []);

  // Connect to Phantom wallet
  const connect = useCallback(async () => {
    try {
      setWalletState(prev => ({ ...prev, connecting: true, error: null }));

      if (!isPhantomInstalled()) {
        throw new Error('Phantom wallet is not installed. Please install Phantom from phantom.app');
      }

      const provider = getProvider();
      if (!provider) {
        throw new Error('Unable to access Phantom wallet provider');
      }

      console.log('Connecting to Phantom wallet...');
      const response = await provider.connect();
      
      const publicKey = response.publicKey.toString();
      console.log('Connected to Phantom wallet:', publicKey);

      setWalletState({
        connected: true,
        connecting: false,
        publicKey,
        error: null,
      });

      return publicKey;
    } catch (error) {
      console.error('Failed to connect to Phantom wallet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Phantom wallet';
      
      setWalletState(prev => ({
        ...prev,
        connecting: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, [isPhantomInstalled, getProvider]);

  // Disconnect from Phantom wallet
  const disconnect = useCallback(async () => {
    try {
      const provider = getProvider();
      if (provider && provider.isConnected) {
        await provider.disconnect();
      }
      
      setWalletState({
        connected: false,
        connecting: false,
        publicKey: null,
        error: null,
      });
      
      console.log('Disconnected from Phantom wallet');
    } catch (error) {
      console.error('Error disconnecting from Phantom wallet:', error);
    }
  }, [getProvider]);

  // Check if already connected on component mount
  useEffect(() => {
    const provider = getProvider();
    if (provider?.isConnected && provider.publicKey) {
      setWalletState({
        connected: true,
        connecting: false,
        publicKey: provider.publicKey.toString(),
        error: null,
      });
    }
  }, [getProvider]);

  // Listen for account changes
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountChange = (publicKey: any) => {
      if (publicKey) {
        setWalletState(prev => ({
          ...prev,
          publicKey: publicKey.toString(),
          connected: true,
        }));
      } else {
        setWalletState({
          connected: false,
          connecting: false,
          publicKey: null,
          error: null,
        });
      }
    };

    provider.on?.('accountChanged', handleAccountChange);
    provider.on?.('disconnect', () => {
      setWalletState({
        connected: false,
        connecting: false,
        publicKey: null,
        error: null,
      });
    });

    return () => {
      provider.off?.('accountChanged', handleAccountChange);
      provider.off?.('disconnect', handleAccountChange);
    };
  }, [getProvider]);

  return {
    ...walletState,
    connect,
    disconnect,
    isPhantomInstalled: isPhantomInstalled(),
    provider: getProvider(),
  };
}