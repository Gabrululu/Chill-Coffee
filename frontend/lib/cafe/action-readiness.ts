// Shared UI prerequisites. Transaction preparation still validates the chain state.
export type DirectoryState = { ready: boolean; loading: boolean; error: string | null; cafes: readonly unknown[] };
export function directoryBlock(state: DirectoryState): string | null {
  if (state.cafes.length) return null;
  if (state.error) return 'The café directory is unavailable. Refresh it before continuing.';
  if (!state.ready) return 'Loading the café directory…';
  return 'No cafés are approved in the event directory yet. The host must approve a café before recipes or tips can be registered.';
}
export function registrationBlock(state: DirectoryState & { connected: boolean; eligibleCount: number; targetId: string }): string | null {
  if (!state.connected) return null; // Keep the connect-wallet action available.
  return directoryBlock(state) ?? (state.eligibleCount === 0
    ? 'This wallet does not own an approved café. Connect the owner wallet or choose a shared café.'
    : !state.targetId ? 'Choose an approved café for your recipe.' : null);
}
export function tipBlock(state: DirectoryState & { connected: boolean; hasTarget: boolean; account: { funded: boolean } | null; accountError: string | null; barista: string | null; configError: string | null; selfTip: boolean; funding: boolean }): string | null {
  if (!state.connected) return 'Connect Freighter on Testnet before preparing a tip.';
  const directory = directoryBlock(state);
  if (directory) return directory;
  if (!state.hasTarget) return 'Choose an approved café before preparing a tip.';
  if (state.funding) return 'Waiting for Testnet funding…';
  if (state.accountError) return 'Your Testnet balance could not be loaded. Refresh the wallet connection.';
  if (!state.account) return 'Checking your Testnet balance…';
  if (!state.account.funded) return 'Get Testnet XLM before preparing a tip.';
  if (state.configError) return 'The café configuration could not be verified. Check the café again.';
  if (!state.barista) return 'Checking the café recipient…';
  if (state.selfTip) return 'This wallet is the café barista. Connect another Testnet account to send a tip.';
  return null;
}
