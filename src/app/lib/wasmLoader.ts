// src/app/lib/wasmLoader.ts

import { PastelModule } from '@/app/types';

declare global {
  interface Window {
    Module: Partial<PastelModule>;
  }
}

let wasmModule: PastelModule | null = null;

/**
 * Initializes the WASM module by loading the script and setting up the module.
 * @returns A promise that resolves to the initialized PastelModule or null if initialization fails.
 */
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
    script.src = '/libpastel_wasm.js'; // Ensure this path is correct
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

/**
 * Retrieves the initialized WASM module.
 * @returns The initialized PastelModule or null if not initialized.
 */
export function getWasmModule(): PastelModule | null {
  return wasmModule;
}

/**
 * Reads the contents of the '/wallet_data' directory.
 * @returns An array of file names in the '/wallet_data' directory, or an empty array if not available.
 */
export function readWalletDataDirectory(): string[] {
  if (typeof window !== 'undefined' && window.Module && window.Module.FS) {
    try {
      return window.Module.FS.readdir('/wallet_data');
    } catch (error) {
      console.error('Error reading /wallet_data directory:', error);
      return [];
    }
  }
  return [];
}