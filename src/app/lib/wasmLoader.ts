// src/app/lib/wasmLoader.ts

import { PastelInstance } from '@/app/types';

type PastelModule = {
  Pastel: new () => PastelInstance;
};

declare global {
  interface Window {
    Module: Partial<PastelModule>;
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
    // Initialize Module as a partial PastelModule
    window.Module = {} as Partial<PastelModule>;

    // Create and append the script
    const script = document.createElement('script');
    script.src = '/libpastel_wasm.js';
    script.async = true;

    // Wait for the script to load and the module to initialize
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WASM module initialization timed out'));
      }, 10000); // 10 second timeout

      script.onload = () => {
        const checkModule = () => {
          if (window.Module && window.Module.Pastel) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkModule, 100);
          }
        };
        checkModule();
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load WASM script'));
      };

      document.body.appendChild(script);
    });

    // Ensure the module is fully initialized before assigning
    if (window.Module && window.Module.Pastel) {
      wasmModule = window.Module as PastelModule;
      return wasmModule;
    } else {
      throw new Error('WASM module did not initialize correctly');
    }
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    return null;
  }
}

export function useWasm(): PastelModule | null {
  return wasmModule;
}