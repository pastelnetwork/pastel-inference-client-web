import { useEffect, useState } from 'react';

interface PastelInstance {
  CreateNewWallet: (password: string) => string;
  ImportWallet: (serializedWallet: string) => void;
  UnlockWallet: (password: string) => boolean;
  GetBalance: () => number;
  GetPastelIDsCount: () => number;
  GetPastelIDByIndex: (index: number, type: string) => string;
  MakeNewPastelID: (makeFullPair: boolean) => string;
  // Add other methods as needed
}

type PastelModule = {
  Pastel: new () => PastelInstance;
};

declare global {
  interface Window {
    Module: PastelModule;
  }
}

let wasmModule: PastelModule | null = null;

export async function initWasm(): Promise<PastelModule | null> {
  if (typeof window === 'undefined') {
    return null; // Return null on the server side
  }

  if (wasmModule) {
    return wasmModule;
  }

  try {
    // Use dynamic import with a more specific path
    await import('/libpastel_wasm.js');
    wasmModule = window.Module;
    return wasmModule;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    return null;
  }
}

export function useWasm(): PastelModule | null {
  const [wasm, setWasm] = useState<PastelModule | null>(null);

  useEffect(() => {
    initWasm().then(setWasm);
  }, []);

  return wasm;
}