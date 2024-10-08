import { PastelInstance } from '@/app/types';

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
    // Load the WASM module
    await import('../../../public/libpastel_wasm.js');
    
    // Wait for the module to be fully initialized
    await new Promise<void>((resolve) => {
      if (window.Module) {
        resolve();
      } else {
        const checkModule = () => {
          if (window.Module) {
            resolve();
          } else {
            setTimeout(checkModule, 10);
          }
        };
        checkModule();
      }
    });

    wasmModule = window.Module;
    return wasmModule;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    return null;
  }
}

export function useWasm(): PastelModule | null {
  return wasmModule;
}