// src/app/lib/initializeApp.ts
import { initWasm } from './wasmLoader';
import BrowserRPCReplacement from './BrowserRPCReplacement';

let rpc: BrowserRPCReplacement | null = null;

export async function initializeApp() {
  rpc = new BrowserRPCReplacement();
  await rpc.initialize();
  return rpc;
}

export function getRPC() {
  if (!rpc) {
    throw new Error('RPC not initialized. Call initializeApp first.');
  }
  return rpc;
}