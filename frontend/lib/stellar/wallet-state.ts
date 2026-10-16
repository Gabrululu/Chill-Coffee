export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'wrong-network' | 'unavailable' | 'error';
export type WalletSnapshot = { status: WalletStatus; address: string | null; network: string | null; error: string | null };
export const DISCONNECTED: WalletSnapshot = { status: 'disconnected', address: null, network: null, error: null };

