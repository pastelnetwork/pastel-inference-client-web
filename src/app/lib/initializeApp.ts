// src/app/lib/initializeApp.ts
import BrowserRPCReplacement from './BrowserRPCReplacement';

/**
 * Initializes the BrowserRPCReplacement singleton instance.
 * @returns The initialized BrowserRPCReplacement instance.
 */
export async function initializeApp(): Promise<BrowserRPCReplacement> {
  const rpc = BrowserRPCReplacement.getInstance();
  await rpc.initialize();
  return rpc;
}

/**
 * Retrieves the initialized BrowserRPCReplacement singleton instance.
 * @returns The BrowserRPCReplacement instance.
 * @throws Error if RPC is not initialized.
 */
export function getRPC(): BrowserRPCReplacement {
  const rpc = BrowserRPCReplacement.getInstance();
  if (!rpc) { // This check is redundant in Singleton, but kept for safety
    throw new Error('RPC not initialized. Call initializeApp first.');
  }
  return rpc;
}
