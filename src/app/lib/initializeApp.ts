// src/app/lib/initializeApp.ts

import BrowserRPCReplacement from './BrowserRPCReplacement';

export async function initializeApp(): Promise<BrowserRPCReplacement> {
  const rpc = BrowserRPCReplacement.getInstance();
  await rpc.initialize();
  return rpc;
}

export function getRPC(): BrowserRPCReplacement {
  const rpc = BrowserRPCReplacement.getInstance();
  if (!rpc) {
    throw new Error('RPC not initialized. Call initializeApp first.');
  }
  return rpc;
}
